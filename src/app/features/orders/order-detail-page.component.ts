import { SafeImageDirective } from '../../shared/resilience/safe-image.directive';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Divider } from 'primeng/divider';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import { I18nService } from '../../core/services/i18n.service';
import { CurrencyService } from '../../core/services/currency.service';
import { OrderService } from '../../core/services/order.service';
import { SiteContentService } from '../../core/services/site-content.service';
import { ScrollService } from '../../core/services/scroll.service';
import type { Order, OrderStatus } from '../../models/order.model';
import { orderStatusLabel, orderStatusSeverity, type StatusSeverity } from '../../shared/utils/order-status.utils';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { DataBoundaryComponent, type BoundaryState } from '../../shared/resilience/data-boundary.component';
import { isApiFailure } from '../../core/resilience/api-failure';
import { ConnectivityService } from '../../core/resilience/connectivity.service';

@Component({
  selector: 'app-order-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SafeImageDirective, RouterLink, Button, Card, Divider, Skeleton, Tag, EmptyStateComponent, MoneyPipe, DataBoundaryComponent],
  templateUrl: './order-detail-page.component.html',
  styleUrl: './order-detail-page.component.scss',
})
export class OrderDetailPageComponent implements OnInit {
  protected i18n = inject(I18nService);
  private currency = inject(CurrencyService);
  private orders = inject(OrderService);
  private siteContent = inject(SiteContentService);
  private scroll = inject(ScrollService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private connectivity = inject(ConnectivityService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * The payment method, as the website content names it.
   *
   * The checkout owns that copy, so the order detail must not invent a
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

  protected state = signal<'loading' | 'ok' | 'error' | 'not_found'>('loading');
  protected order = signal<Order | null>(null);
  protected error = signal<unknown>(null);

  protected boundaryState = computed<BoundaryState>(() => {
    switch (this.state()) {
      case 'loading':
        return 'loading';
      case 'not_found':
        return 'empty';
      case 'error':
        return 'error';
      default:
        return this.order() ? 'success' : 'empty';
    }
  });

  ngOnInit(): void {
    // Fresh mount carried over the list's scroll position: start at the top.
    this.scroll.scrollToTop();
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.error.set(null);
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.orders
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (o) => {
          this.order.set(o);
          this.state.set('ok');
        },
        error: (err: unknown) => {
          const notFound =
            (isApiFailure(err) && err.kind === 'not_found') ||
            (err instanceof Error && err.message.includes('not-found'));
          this.error.set(err);
          this.state.set(notFound ? 'not_found' : 'error');
        },
      });
  }

  protected dateOf(iso: string): string {
    return this.currency.formatDate(iso);
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

  /** Explicit Retry after an outage: reset the breaker and refetch. */
  protected retry(): void {
    this.connectivity.retryNow();
    this.load();
  }
}
