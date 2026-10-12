import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Divider } from 'primeng/divider';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { I18nService } from '../../core/services/i18n.service';
import { CurrencyService } from '../../core/services/currency.service';
import { CartStore } from '../../core/services/cart.store';
import { CartViewService } from '../../core/services/cart-view.service';
import { NotificationService } from '../../core/services/notification.service';
import { environment } from '../../../environments/environment';
import { QtySelectorComponent } from '../../shared/components/qty-selector.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { handleImgError } from '../../shared/utils/image-fallback.utils';

@Component({
  selector: 'app-cart-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Button, Card, Divider, Message, Skeleton, QtySelectorComponent, EmptyStateComponent, MoneyPipe],
  templateUrl: './cart-page.component.html',
  styleUrl: './cart-page.component.scss',
})
export class CartPageComponent {
  protected i18n = inject(I18nService);
  protected currency = inject(CurrencyService);
  protected cart = inject(CartStore);
  protected view = inject(CartViewService);
  private notify = inject(NotificationService);
  private confirm = inject(ConfirmationService);
  private router = inject(Router);

  // All rows (including explicit "unavailable" rows) come from the shared
  // CartViewService, so badge, page and checkout can never disagree.
  // Money derives from priced lines only — unavailable rows show 0.
  protected subtotal = computed(() => this.view.pricedSubtotal());
  // Hotel-specific fees are quoted at checkout (hotel unknown here), so the
  // cart shows the subtotal plus a "calculated at checkout" note instead of a
  // misleading flat fee. The threshold hint below still uses the subtotal.
  protected freeShipHint = computed(() => {
    const sub = this.subtotal();
    if (sub <= 0) return null;
    if (sub >= environment.freeShippingThreshold)
      return { free: true, text: this.i18n.t('cart.freeShippingDone') };
    const missing = environment.freeShippingThreshold - sub;
    return { free: false, text: this.i18n.t('cart.freeShippingHint', { amount: this.currency.format(missing) }) };
  });

  protected retry(): void {
    this.view.refresh();
  }

  // Small line thumbnails share the two-stage recovery (their fixed box
  // dimensions already prevent layout collapse).
  protected imgFallback(ev: Event, seed: string): void {
    handleImgError(ev, seed);
  }

  protected setQty(key: string, qty: number, max: number): void {
    this.cart.setQty(key, qty, Math.max(1, max));
  }

  protected remove(key: string): void {
    this.cart.remove(key);
    this.notify.success('cart.itemRemoved');
  }

  protected askClear(): void {
    // Destructive action: confirm before wiping the guest cart.
    this.confirm.confirm({
      header: this.i18n.t('cart.clearConfirmTitle'),
      message: this.i18n.t('cart.clearConfirmMessage'),
      acceptLabel: this.i18n.t('cart.confirmYes'),
      rejectLabel: this.i18n.t('cart.cancel'),
      accept: () => {
        this.cart.clear();
        this.notify.success('cart.cartCleared');
      },
    });
  }

  protected go(path: string): void {
    this.router.navigate([path]);
  }
}
