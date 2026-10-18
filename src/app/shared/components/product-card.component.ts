import { LocalizedPipe } from '../pipes/localized.pipe';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { I18nService } from '../../core/services/i18n.service';
import { FavoritesStore } from '../../core/services/favorites.store';
import { handleImgError } from '../utils/image-fallback.utils';
import { discountPercent, effectivePrice, type Product } from '../../models/product.model';
import { ResolvedMoneyPipe } from '../pipes/resolved-money.pipe';
import { QtySelectorComponent } from './qty-selector.component';

@Component({
  selector: 'app-product-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Button, Tag, Tooltip, ResolvedMoneyPipe, QtySelectorComponent,
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
  protected quantity = signal(1);

  protected effective(): number {
    return effectivePrice(this.product);
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
    // The whole card links to the details page: stop the heart click from navigating.
    ev.preventDefault();
    ev.stopPropagation();
    this.favToggle.emit(this.product);
  }

  protected onImgError(ev: Event): void {
    // Shared two-stage recovery: picsum attempt, then the framed placeholder
    // behind the image (see .img-frame in styles.scss).
    handleImgError(ev, this.product.id);
  }
}
