import { Injectable, effect, signal, untracked } from '@angular/core';
import { catchError, of } from 'rxjs';
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

  constructor(
    private auth: AuthService,
    private cart: CartStore,
    private favorites: FavoritesStore,
    private api: ApiClientService,
  ) {
    // Pull once per session start.
    effect(() => {
      const user = this.auth.user();
      if (environment.useMockApi || !user) return;
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
    this.api
      .get<ServerCart>('cart')
      .pipe(catchError(() => of({ lines: [] } as ServerCart)))
      .subscribe((res) => {
        this.cart.replaceAll(res.lines ?? []);
        this.api
          .get<{ productIds: string[] }>('favorites')
          .pipe(catchError(() => of({ productIds: [] })))
          .subscribe((fav) => {
            this.favorites.replaceAll(fav.productIds ?? []);
            this.suppressPush.set(false);
          });
      });
  }

  private pushSoon(
    lines: { productId: string; variantKey?: string; variantLabel?: string; qty: number }[],
    ids: string[],
  ): void {
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.api.put('cart', { lines }).pipe(catchError(() => of(null))).subscribe();
      // Favorites push is best-effort per id: backend is id-keyed, so a full
      // replace is emulated by adding missing ids (removals sync on pull).
      for (const id of ids) {
        this.api.post('favorites', { productId: id }).pipe(catchError(() => of(null))).subscribe();
      }
    }, 800);
  }
}
