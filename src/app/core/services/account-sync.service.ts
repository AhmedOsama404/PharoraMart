import { Injectable, effect, signal, untracked } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
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
   * The combination happens EXACTLY ONCE per session: repeating it would
   * add the server cart to the local cart on every pull and the quantity
   * would grow without bound (35 -> 70 -> 140 ...).
   */
  private handoverDone = false;
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
      if (this.handoverDone) {
        // The account cart is the source of truth from now on: adopt it.
        // Adding it to the local cart again would double the quantities on
        // every pull.
        this.cart.replaceAll(cart.lines ?? []);
      } else {
        // The FIRST pull of the session combines the guest cart with the
        // account cart - once. The combined cart is pushed up by the push
        // effect, and the server clamps every line to the live stock.
        this.cart.mergeAll(cart.lines ?? []);
        this.handoverDone = true;
      }

      const serverIds = (favorites.productIds ?? []).filter((id): id is string => typeof id === 'string');
      this.serverFavoriteIds = new Set(serverIds);
      this.favorites.replaceAll([...new Set([...serverIds, ...this.favorites.ids()])]);
      this.suppressPush.set(false);
    });
  }

  private pushSoon(
    lines: { productId: string; variantKey?: string; variantLabel?: string; qty: number }[],
    ids: string[],
  ): void {
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.api.put('cart', { lines }).pipe(catchError(() => of(null))).subscribe();
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
