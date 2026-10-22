import { SafeImageDirective } from '../resilience/safe-image.directive';
import { LocalizedPipe } from '../pipes/localized.pipe';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { I18nService } from '../../core/services/i18n.service';
import { CurrencyService } from '../../core/services/currency.service';
import { FavoritesStore } from '../../core/services/favorites.store';
import { MAX_QTY_PER_LINE } from '../../core/services/cart.store';
import { handleImgError } from '../utils/image-fallback.utils';
import { discountPercent, effectivePrice, type Product } from '../../models/product.model';
import { ResolvedMoneyPipe } from '../pipes/resolved-money.pipe';
import { QtySelectorComponent } from './qty-selector.component';

@Component({
  selector: 'app-product-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SafeImageDirective, RouterLink, Button, Tag, Tooltip, ResolvedMoneyPipe, QtySelectorComponent,
    LocalizedPipe,
  ],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
})
export class ProductCardComponent {
  // The product to render. Always provided by catalog, home and related lists.
  @Input({ required: true }) product!: Product;
  // Bubbles the selected quantity up so the owning page can update cart + toast state.
  @Output() add = new EventEmitter<{ product: Product; quantity: number }>();
  // Same for favorites: the page owns the store, the card only reports intent.
  @Output() favToggle = new EventEmitter<Product>();

  protected i18n = inject(I18nService);
  protected favorites = inject(FavoritesStore);
  private currency = inject(CurrencyService);
  protected quantity = signal(1);

  protected effective(): number {
    return effectivePrice(this.product);
  }

  /**
   * The currency the stored price is expressed in. Older records and local
   * demo products carry no currency — their amount is already the visitor's
   * selected currency, so the price must never render blank.
   */
  protected priceCurrency(): string {
    return this.product.currency ?? this.currency.code();
  }

  /**
   * The most units that can be chosen: the live stock, never more than the
   * per-item cap of an order.
   */
  protected maxQty(): number {
    return Math.max(1, Math.min(this.product?.stock || 1, MAX_QTY_PER_LINE));
  }

  protected discount(): number {
    return discountPercent(this.product);
  }

  protected addToCart(): void {
    if (this.quantity() < 1 || this.product.stock <= 0) return;
    this.add.emit({ product: this.product, quantity: this.quantity() });
    this.quantity.set(1);
  }

  protected onFav(ev: Event): void {
    // The favourite button is a sibling of the card link (never inside it), so
    // a heart click can no longer navigate to the product page.
    ev.stopPropagation();
    this.favToggle.emit(this.product);
  }

  protected onImgError(ev: Event): void {
    // Shared two-stage recovery: picsum attempt, then the framed placeholder
    // behind the image (see .img-frame in styles.scss).
    handleImgError(ev, this.product.id);
  }
}
