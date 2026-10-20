import { SafeImageDirective } from '../../shared/resilience/safe-image.directive';
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Divider } from 'primeng/divider';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { I18nService } from '../../core/services/i18n.service';
import { CurrencyService } from '../../core/services/currency.service';
import { CartStore, MAX_QTY_PER_LINE } from '../../core/services/cart.store';
import { CartViewService } from '../../core/services/cart-view.service';
import { NotificationService } from '../../core/services/notification.service';
import { environment } from '../../../environments/environment';
import { PriceResolverService } from '../../core/services/price-resolver.service';
import { QtySelectorComponent } from '../../shared/components/qty-selector.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { DataBoundaryComponent, type BoundaryState } from '../../shared/resilience/data-boundary.component';
import { ConnectivityService } from '../../core/resilience/connectivity.service';

@Component({
  selector: 'app-cart-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SafeImageDirective, RouterLink, Button, Card, Divider, Message, Skeleton, QtySelectorComponent, EmptyStateComponent, MoneyPipe, DataBoundaryComponent],
  templateUrl: './cart-page.component.html',
  styleUrl: './cart-page.component.scss',
})
export class CartPageComponent {
  protected i18n = inject(I18nService);
  protected currency = inject(CurrencyService);
  protected cart = inject(CartStore);
  protected view = inject(CartViewService);
  private prices = inject(PriceResolverService);
  private notify = inject(NotificationService);
  private confirm = inject(ConfirmationService);
  private router = inject(Router);
  private connectivity = inject(ConnectivityService);

  /** One terminal state for the whole cart: loading, failure, empty or rows. */
  protected boundaryState = computed<BoundaryState>(() => {
    if (!this.view.ready()) return 'loading';
    if (this.view.failed()) {
      return this.connectivity.status() === 'offline' ? 'offline' : 'error';
    }
    return this.cart.isEmpty() ? 'empty' : 'success';
  });

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
    const threshold = this.prices.resolve(environment.freeShippingThreshold, 'USD')?.amount;
    if (threshold == null) return null;
    if (sub >= threshold)
      return { free: true, text: this.i18n.t('cart.freeShippingDone') };
    const missing = threshold - sub;
    return { free: false, text: this.i18n.t('cart.freeShippingHint', { amount: this.currency.format(missing) }) };
  });

  private autoRetried = false;

  constructor() {
    this.connectivity.recovered$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (this.view.failed() && !this.autoRetried) {
          this.autoRetried = true;
          this.view.refresh();
        }
      });
    effect(() => {
      if (!this.view.failed()) this.autoRetried = false;
    });
  }

  protected retry(): void {
    this.autoRetried = true;
    this.connectivity.retryNow();
    this.view.refresh();
  }

  /** The most units that can be chosen: the stock, never more than the cap. */
  protected maxQty(stock: number): number {
    return Math.max(1, Math.min(stock || 1, MAX_QTY_PER_LINE));
  }

  /** The most units of one product an order may hold. */
  protected readonly perItemCap = MAX_QTY_PER_LINE;

  /**
   * True when the line sits at the per-item cap and the stock is not the
   * limit - the message has to say which one it is.
   */
  protected atPerItemCap(stock: number, qty: number): boolean {
    return stock > MAX_QTY_PER_LINE && qty >= MAX_QTY_PER_LINE;
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
