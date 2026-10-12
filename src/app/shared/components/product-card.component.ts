import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { I18nService } from '../../core/services/i18n.service';
import { FavoritesStore } from '../../core/services/favorites.store';
import { handleImgError } from '../utils/image-fallback.utils';
import { discountPercent, effectivePrice, type Product } from '../../models/product.model';
import { MoneyPipe } from '../pipes/money.pipe';

@Component({
  selector: 'app-product-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Button, Tag, Tooltip, MoneyPipe],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
})
export class ProductCardComponent {
  // The product to render. Always provided by catalog, home and related lists.
  @Input({ required: true }) product!: Product;
  // Bubbles up so the owning page can update cart + toast state in one place.
  @Output() add = new EventEmitter<Product>();
  // Same for favorites: the page owns the store, the card only reports intent.
  @Output() favToggle = new EventEmitter<Product>();

  protected i18n = inject(I18nService);
  protected favorites = inject(FavoritesStore);

  protected effective(): number {
    return effectivePrice(this.product);
  }

  protected discount(): number {
    return discountPercent(this.product);
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
