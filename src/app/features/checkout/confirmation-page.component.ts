import { SafeImageDirective } from '../../shared/resilience/safe-image.directive';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Divider } from 'primeng/divider';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { I18nService } from '../../core/services/i18n.service';
import { CurrencyService } from '../../core/services/currency.service';
import { OrderService } from '../../core/services/order.service';
import { ContactService } from '../../core/services/contact.service';
import { ScrollService } from '../../core/services/scroll.service';
import type { Order } from '../../models/order.model';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { DataBoundaryComponent, type BoundaryState } from '../../shared/resilience/data-boundary.component';
import { isApiFailure } from '../../core/resilience/api-failure';
import { SiteContentService } from '../../core/services/site-content.service';
import type { SiteOrderConfirmationContent } from '../../models/site-content.model';

@Component({
  selector: 'app-confirmation-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SafeImageDirective, Button, Card, Divider, Message, Skeleton, EmptyStateComponent, MoneyPipe, DataBoundaryComponent],
  templateUrl: './confirmation-page.component.html',
  styleUrl: './confirmation-page.component.scss',
})
export class ConfirmationPageComponent implements OnInit {
  protected i18n = inject(I18nService);
  protected siteContent = inject(SiteContentService);
  private currency = inject(CurrencyService);
  private orders = inject(OrderService);
  protected contact = inject(ContactService);
  private scroll = inject(ScrollService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

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
    // Arriving from the checkout submit button (bottom of a long form):
    // start at the confirmation summary, not mid-page.
    this.scroll.scrollToTop();
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.error.set(null);
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.orders.getById(id).subscribe({
      next: (o) => {
        this.order.set(o);
        this.state.set('ok');
      },
      error: (err: unknown) => {
        // Only a real 404 is "not found"; an outage must offer Retry.
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

  protected copy(key: keyof SiteOrderConfirmationContent, fallbackKey: string): string {
    const content = this.siteContent.orderConfirmation();
    return this.siteContent.text(content?.[key] as import('../../models/product.model').LocalizedText | undefined, this.i18n.currentLang()) || this.i18n.t(fallbackKey);
  }

  protected show(key: 'showNextSteps' | 'showWhatsAppButton' | 'showEmailButton' | 'showDemoNotice'): boolean {
    return this.siteContent.orderConfirmation()?.[key] !== false;
  }

  // Both actions only OPEN the external app with a pre-filled message.
  // Nothing is ever sent automatically (see the hints in the template).
  protected wa(): void {
    if (this.order()) this.contact.openWhatsApp(this.order()!);
  }

  protected mail(): void {
    if (this.order()) this.contact.openEmail(this.order()!);
  }

  protected go(path: string): void {
    this.router.navigate([path]);
  }
}
