import { SafeImageDirective } from '../resilience/safe-image.directive';
import { LocalizedPipe } from '../pipes/localized.pipe';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { I18nService } from '../../core/services/i18n.service';
import { CurrencyService } from '../../core/services/currency.service';
import { FavoritesStore } from '../../core/services/favorites.store';
import { PromotionService } from '../../core/services/promotion.service';
import { MAX_QTY_PER_LINE } from '../../core/services/cart.store';
import { LANG_LOCALES } from '../../core/config/i18n.config';
import { discountPercent, effectivePrice, type Product } from '../../models/product.model';
import { ResolvedMoneyPipe } from '../pipes/resolved-money.pipe';
import { QtySelectorComponent } from './qty-selector.component';

type StarState = 'full' | 'half' | 'empty';

@Component({
  selector: 'app-product-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SafeImageDirective, RouterLink, Button, Tooltip, ResolvedMoneyPipe, QtySelectorComponent,
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
  private promotion = inject(PromotionService);
  protected quantity = signal(1);

  /** Active campaign badge for this product (authored text or coupon rate). */
  protected campaignBadge = computed(() => this.promotion.badgeFor(this.product.id, this.product.categoryId));

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

  /** A sale badge only makes sense when the sale price is actually lower. */
  protected isDiscounted(): boolean {
    return this.discount() > 0;
  }

  protected hasRating(): boolean {
    return (this.product.reviewsCount ?? 0) > 0 && (this.product.rating ?? 0) > 0;
  }

  protected stars(): StarState[] {
    const rating = Math.max(0, Math.min(5, this.product.rating ?? 0));
    return Array.from({ length: 5 }, (_, index) => {
      const delta = rating - index;
      return delta >= 0.75 ? 'full' : delta >= 0.25 ? 'half' : 'empty';
    });
  }

  protected ratingText(): string {
    return this.numberFormat(1).format(this.product.rating ?? 0);
  }

  protected reviewsText(): string {
    return this.numberFormat(0).format(this.product.reviewsCount ?? 0);
  }

  // Cards re-render in grids of two dozen; formatter construction is the
  // expensive part, so one instance is kept per locale+precision.
  private readonly numberFormats = new Map<string, Intl.NumberFormat>();

  private numberFormat(fractionDigits: number): Intl.NumberFormat {
    const locale = LANG_LOCALES[this.i18n.currentLang()];
    const key = `${locale}|${fractionDigits}`;
    let formatter = this.numberFormats.get(key);
    if (!formatter) {
      formatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      });
      this.numberFormats.set(key, formatter);
    }
    return formatter;
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
}
