import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import { I18nService } from '../../core/services/i18n.service';
import { CurrencyService } from '../../core/services/currency.service';
import { OrderService } from '../../core/services/order.service';
import { SiteContentService } from '../../core/services/site-content.service';
import { ConnectivityService } from '../../core/resilience/connectivity.service';
import type { Order, OrderStatus } from '../../models/order.model';
import { orderStatusLabel, orderStatusSeverity, type StatusSeverity } from '../../shared/utils/order-status.utils';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { DataBoundaryComponent, type BoundaryState } from '../../shared/resilience/data-boundary.component';

@Component({
  selector: 'app-orders-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Button, Card, Skeleton, Tag, EmptyStateComponent, MoneyPipe, DataBoundaryComponent],
  templateUrl: './orders-page.component.html',
  styleUrl: './orders-page.component.scss',
})
export class OrdersPageComponent implements OnInit {
  protected i18n = inject(I18nService);
  private currency = inject(CurrencyService);
  private orderService = inject(OrderService);
  private siteContent = inject(SiteContentService);
  private router = inject(Router);
  private connectivity = inject(ConnectivityService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * The payment method, as the website content names it.
   *
   * The checkout owns that copy, so the order history must not invent a
   * second wording for it.
   */
  protected readonly paymentMethodLabel = computed(() => {
    const label = this.siteContent.text(
      this.siteContent.checkout()?.paymentMethodTitle as
        | import('../../models/product.model').LocalizedText
        | undefined,
      this.i18n.currentLang(),
    );
    return label || this.i18n.t('confirmation.cashOnDelivery');
  });

  protected state = signal<'loading' | 'ok' | 'error'>('loading');
  protected orders = signal<Order[]>([]);
  protected error = signal<unknown>(null);
  private autoRetried = false;

  constructor() {
    this.connectivity.recovered$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (this.state() === 'error' && !this.autoRetried) {
          this.autoRetried = true;
          this.load();
        }
      });
  }

  protected boundaryState = computed<BoundaryState>(() => {
    if (this.state() === 'loading') return 'loading';
    if (this.state() === 'error') {
      return this.connectivity.status() === 'offline' ? 'offline' : 'error';
    }
    return this.orders().length ? 'success' : 'empty';
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.error.set(null);
    this.orderService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.orders.set(items);
          this.autoRetried = false;
          this.state.set('ok');
        },
        error: (err: unknown) => {
          this.error.set(err);
          this.state.set('error');
        },
      });
  }

  /** Explicit Retry: reset the breaker and refetch. */
  protected retry(): void {
    this.autoRetried = true;
    this.connectivity.retryNow();
    this.load();
  }

  protected dateOf(iso: string): string {
    return this.currency.formatDate(iso);
  }

  protected itemCount(o: Order): number {
    return o.items.reduce((n, i) => n + i.qty, 0);
  }

  protected statusLabel(s: OrderStatus): string {
    return orderStatusLabel(s, (k) => this.i18n.t(k));
  }

  protected statusSeverity(s: OrderStatus): StatusSeverity {
    return orderStatusSeverity(s);
  }

  protected go(path: string): void {
    this.router.navigate([path]);
  }
}
