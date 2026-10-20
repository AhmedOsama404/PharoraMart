import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import { I18nService } from '../../core/services/i18n.service';
import { CurrencyService } from '../../core/services/currency.service';
import { OrderService } from '../../core/services/order.service';
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
  private router = inject(Router);
  private connectivity = inject(ConnectivityService);

  protected state = signal<'loading' | 'ok' | 'error'>('loading');
  protected orders = signal<Order[]>([]);
  protected error = signal<unknown>(null);

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
    this.orderService.list().subscribe({
      next: (items) => {
        this.orders.set(items);
        this.state.set('ok');
      },
      error: (err: unknown) => {
        this.error.set(err);
        this.state.set('error');
      },
    });
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
