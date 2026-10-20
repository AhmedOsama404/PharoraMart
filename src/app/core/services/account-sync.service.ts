import { Injectable, effect, signal, untracked } from '@angular/core';
import { catchError, forkJoin, of, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiClientService } from '../api/api-client.service';
import { AuthService } from './auth.service';
import { CartStore } from './cart.store';
import { FavoritesStore } from './favorites.store';

interface ServerCart {
  lines: { productId: string; variantKey?: string; variantLabel?: string; qty: number }[];
}

/**
 * Account synchronization for live-API mode (no-op in mock mode).
 * - Pulls the server cart/favorites when a session starts.
 * - Pushes local changes back debounced (server clamps to stock).
 * Local signals stay the UI source of truth, so offline edits never block.
 */
@Injectable({ providedIn: 'root' })
export class AccountSyncService {
  private suppressPush = signal(false);
  private pushTimer: ReturnType<typeof setTimeout> | undefined;
  private lastPulledUserId: string | null = null;
  /**
   * True once the guest cart has been combined with the account cart.
   *
   * The combination happens EXACTLY ONCE per account, and the marker is
   * STORED: a flag in memory was lost on every page reload, so the guest
   * cart and the account cart were added again and again (4 -> 8 -> 16).
   *
   * The marker is set when the local cart is PUSHED to the server, not
   * when it is pulled: from that moment the local cart is a mirror of the
   * server cart, and adding the two together would double the quantity.
   */
  private handoverDone = false;

  private static readonly HANDOVER_KEY = 'novamart.cart.handover.v1';
  private serverFavoriteIds = new Set<string>();

  constructor(
    private auth: AuthService,
    private cart: CartStore,
    private favorites: FavoritesStore,
    private api: ApiClientService,
  ) {
    // Pull once per session start.
    effect(() => {
      const user = this.auth.user();
      if (environment.useMockApi) return;
      if (!user) {
        // A sign-out empties the local cart: it was a mirror of the account
        // cart and it must never leak into the next account. On a first
        // visit (no user yet) the guest cart is left alone.
        if (this.lastPulledUserId) {
          this.clearHandover(this.lastPulledUserId);
          this.lastPulledUserId = null;
          this.handoverDone = false;
          this.cart.clear();
          this.serverFavoriteIds.clear();
        }

        return;
      }
      if (this.lastPulledUserId === user.id) return;
      this.lastPulledUserId = user.id;
      untracked(() => this.pull());
    });
    // Push local mutations back (debounced; suppressed while pulling).
    effect(() => {
      const lines = this.cart.lines();
      const ids = this.favorites.ids();
      if (environment.useMockApi || !this.auth.isLoggedIn() || this.suppressPush()) return;
      untracked(() => this.pushSoon(lines, ids));
    });
  }

  /** Loads server cart + favorites into the local stores. */
  pull(): void {
    if (environment.useMockApi || !this.auth.isLoggedIn()) return;
    this.suppressPush.set(true);
    forkJoin({
      cart: this.api.get<ServerCart>('cart').pipe(catchError(() => of({ lines: [] } as ServerCart))),
      favorites: this.api.get<{ productIds: string[] }>('favorites').pipe(catchError(() => of({ productIds: [] }))),
    }).subscribe(({ cart, favorites }) => {
      const userId = this.auth.user()?.id ?? 'anonymous';

      if (this.handoverDone || this.hasHandover(userId)) {
        // The local cart is already a mirror of the server cart: adopt the
        // server's answer. Nothing is added, so a reload can never change
        // the quantity.
        this.cart.replaceAll(cart.lines ?? []);
      } else {
        // The FIRST time: the guest cart and the account cart are combined
        // ONCE. The combined value is sent up and the server's answer
        // (clamped to the live stock) is what the cart adopts. The combined
        // value never lands in the cart itself.
        this.handoverDone = true;
        this.pushAndAdopt(this.cart.mergedWith(cart.lines ?? []));
      }

      const serverIds = (favorites.productIds ?? []).filter((id): id is string => typeof id === 'string');
      this.serverFavoriteIds = new Set(serverIds);
      this.favorites.replaceAll([...new Set([...serverIds, ...this.favorites.ids()])]);
      this.suppressPush.set(false);
    });
  }

  /**
   * Sends the given lines and adopts the server's answer. The server
   * replaces the cart and clamps every line to the live stock, so the
   * numbers are the truth even when the local cart was stale.
   */
  private pushAndAdopt(lines: { productId: string; variantKey?: string; variantLabel?: string; qty: number }[]): void {
    this.api
      .put('cart', { lines })
      .pipe(switchMap(() => this.api.get<ServerCart>('cart')))
      .pipe(catchError(() => of(null)))
      .subscribe((serverCart) => {
        if (serverCart) {
          this.cart.replaceAll(serverCart.lines ?? []);
          // The local cart is now the server cart.
          this.markHandover(this.auth.user()?.id ?? 'anonymous');
        }
      });
  }

  /** True when the guest cart was already combined with this account. */
  private hasHandover(userId: string): boolean {
    try {
      return localStorage.getItem(`${AccountSyncService.HANDOVER_KEY}.${userId}`) === '1';
    } catch {
      return false;
    }
  }

  private markHandover(userId: string): void {
    try {
      localStorage.setItem(`${AccountSyncService.HANDOVER_KEY}.${userId}`, '1');
    } catch {
      /* ignore */
    }
  }

  private clearHandover(userId: string): void {
    try {
      localStorage.removeItem(`${AccountSyncService.HANDOVER_KEY}.${userId}`);
    } catch {
      /* ignore */
    }
  }

  private pushSoon(
    lines: { productId: string; variantKey?: string; variantLabel?: string; qty: number }[],
    ids: string[],
  ): void {
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.api
        .put('cart', { lines })
        .pipe(
          tap(() => {
            // The local cart is now the server cart: from here on the server
            // is the source of truth and a reload cannot change the quantity.
            // The marker is set only when the push actually SUCCEEDED: a
            // failed push must not make the next pull throw the local
            // cart away.
            const userId = this.auth.user()?.id ?? 'anonymous';
            this.markHandover(userId);
          }),
          catchError(() => of(null)),
        )
        .subscribe();
      // Keep the server set aligned with local changes. This sends only the
      // delta and makes removals persist across sessions.
      for (const id of ids) {
        if (this.serverFavoriteIds.has(id)) continue;
        this.api.post('favorites', { productId: id }).pipe(catchError(() => of(false))).subscribe((result) => {
          if (result !== false) this.serverFavoriteIds.add(id);
        });
      }
      const nextIds = new Set(ids);
      for (const id of this.serverFavoriteIds) {
        if (nextIds.has(id)) continue;
        this.api.delete(`favorites/${encodeURIComponent(id)}`).pipe(catchError(() => of(false))).subscribe((result) => {
          if (result !== false) this.serverFavoriteIds.delete(id);
        });
      }
    }, 800);
  }
}
