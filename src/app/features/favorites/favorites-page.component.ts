import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { I18nService } from '../../core/services/i18n.service';
import { ProductService } from '../../core/services/product.service';
import { CartStore } from '../../core/services/cart.store';
import { FavoritesStore } from '../../core/services/favorites.store';
import { NotificationService } from '../../core/services/notification.service';
import type { Product } from '../../models/product.model';
import { ProductCardComponent } from '../../shared/components/product-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { DataBoundaryComponent, type BoundaryState } from '../../shared/resilience/data-boundary.component';
import { ConnectivityService } from '../../core/resilience/connectivity.service';

@Component({
  selector: 'app-favorites-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProductCardComponent, EmptyStateComponent, DataBoundaryComponent],
  templateUrl: './favorites-page.component.html',
  styleUrl: './favorites-page.component.scss',
})
export class FavoritesPageComponent {
  protected i18n = inject(I18nService);
  private products = inject(ProductService);
  private cart = inject(CartStore);
  protected favorites = inject(FavoritesStore);
  private notify = inject(NotificationService);
  private router = inject(Router);
  private connectivity = inject(ConnectivityService);

  private catalog = signal<Product[]>([]);
  protected state = signal<'loading' | 'ok' | 'error'>('loading');
  protected error = signal<unknown>(null);

  protected boundaryState = computed<BoundaryState>(() => {
    if (this.state() === 'loading') return 'loading';
    if (this.state() === 'error') {
      return this.connectivity.status() === 'offline' ? 'offline' : 'error';
    }
    return this.items().length ? 'success' : 'empty';
  });

  private autoRetried = false;

  constructor() {
    effect(() => {
      const ids = this.favorites.ids();
      this.load(ids);
    });
    this.connectivity.recovered$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (this.state() === 'error' && !this.autoRetried) {
          this.autoRetried = true;
          this.load(this.favorites.ids());
        }
      });
  }

  protected retry(): void {
    this.autoRetried = true;
    this.connectivity.retryNow();
    this.load(this.favorites.ids());
  }

  private load(ids: readonly string[]): void {
    this.state.set('loading');
    this.error.set(null);
    if (!ids.length) {
      this.catalog.set([]);
      this.state.set('ok');
      return;
    }
    this.products.getByIdsMany(ids).subscribe({
      next: (items) => {
        this.catalog.set(items);
        this.autoRetried = false;
        this.state.set('ok');
      },
      error: (err: unknown) => {
        this.catalog.set([]);
        this.error.set(err);
        this.state.set('error');
      },
    });
  }

  // Saved ids resolved against the catalog (a favorite whose product vanished
  // simply drops out instead of crashing the page).
  protected items = computed(() => {
    const ids = new Set(this.favorites.ids());
    return this.catalog().filter((p) => ids.has(p.id));
  });

  protected moveToCart({ product: p, quantity }: { product: Product; quantity: number }): void {
    if (p.stock > 0) {
      this.cart.add(p.id, quantity, undefined, undefined, p.stock);
      this.notify.success('notifications.addedToCart');
    }
  }

  protected remove(p: Product): void {
    this.favorites.remove(p.id);
    this.notify.success('favorites.removed');
  }

  protected go(path: string): void {
    this.router.navigate([path]);
  }
}
