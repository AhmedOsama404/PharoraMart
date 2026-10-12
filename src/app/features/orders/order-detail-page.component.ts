import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Divider } from 'primeng/divider';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import { I18nService } from '../../core/services/i18n.service';
import { CurrencyService } from '../../core/services/currency.service';
import { OrderService } from '../../core/services/order.service';
import { ScrollService } from '../../core/services/scroll.service';
import type { Order, OrderStatus } from '../../models/order.model';
import { orderStatusLabel, orderStatusSeverity, type StatusSeverity } from '../../shared/utils/order-status.utils';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { handleImgError } from '../../shared/utils/image-fallback.utils';

@Component({
  selector: 'app-order-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Button, Card, Divider, Skeleton, Tag, EmptyStateComponent, MoneyPipe],
  templateUrl: './order-detail-page.component.html',
  styleUrl: './order-detail-page.component.scss',
})
export class OrderDetailPageComponent implements OnInit {
  protected i18n = inject(I18nService);
  private currency = inject(CurrencyService);
  private orders = inject(OrderService);
  private scroll = inject(ScrollService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected state = signal<'loading' | 'ok'>('loading');
  protected order = signal<Order | null>(null);

  ngOnInit(): void {
    // Fresh mount carried over the list's scroll position: start at the top.
    this.scroll.scrollToTop();
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.orders.getById(id).subscribe({
      next: (o) => {
        this.order.set(o);
        this.state.set('ok');
      },
      // Unknown id: show not-found instead of loading forever.
      error: () => this.state.set('ok'),
    });
  }

  protected dateOf(iso: string): string {
    return this.currency.formatDate(iso);
  }

  // Receipt thumbnails share the two-stage recovery (fixed-size box).
  protected imgFallback(ev: Event, seed: string): void {
    handleImgError(ev, seed);
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
