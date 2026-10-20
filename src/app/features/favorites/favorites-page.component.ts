import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/services/i18n.service';
import { ProductService } from '../../core/services/product.service';
import { CartStore } from '../../core/services/cart.store';
import { FavoritesStore } from '../../core/services/favorites.store';
import { NotificationService } from '../../core/services/notification.service';
import type { Product } from '../../models/product.model';
import { catchError, of } from 'rxjs';
import { ProductCardComponent } from '../../shared/components/product-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

@Component({
  selector: 'app-favorites-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProductCardComponent, EmptyStateComponent],
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

  private catalog = signal<Product[]>([]);

  constructor() {
    effect((onCleanup) => {
      const ids = this.favorites.ids();
      const subscription = this.products.getByIdsMany(ids)
        .pipe(catchError(() => of([])))
        .subscribe((items) => this.catalog.set(items));
      onCleanup(() => subscription.unsubscribe());
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
