import { Injectable, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiClientService } from '../api/api-client.service';
import { toStoreSettings } from '../api/store-settings.mapper';
import type { ContactMode, StoreSettings } from '../../models/store-settings.model';
import type { Order } from '../../models/order.model';
import { CurrencyService } from './currency.service';
import { I18nService } from './i18n.service';

/**
 * Contact adapter — prepares (but never sends) external messages.
 * WhatsApp uses the official wa.me click-to-chat URL; email uses mailto:.
 * Real delivery requires a backend provider (see docs/API_CONTRACT.md).
 *
 * The contact details (WhatsApp number, support email, business hours and
 * the contact mode) are ADMIN-EDITABLE and are read from the public
 * `GET store/settings` endpoint. The bundled `environment.*` values are only
 * the fallback: they keep the storefront working while the API is
 * unreachable, before the first load, and for a store that has not filled
 * the fields in yet.
 */
@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly api = inject(ApiClientService);
  private readonly settings = signal<StoreSettings | null>(null);
  private readonly settingsLoaded = signal(false);
  /** Guards the one-per-session load; a failed load may be retried. */
  private requested = false;

  /** True once the first store-settings load has settled (success or failure). */
  readonly ready = this.settingsLoaded.asReadonly();

  /**
   * The live store settings.
   *
   * Exposed as a signal so a template can build the WhatsApp / email / hours
   * rows from them — the store's channels are the single source of truth for
   * every place the customer can reach the shop.
   */
  readonly channels = this.settings.asReadonly();

  constructor(
    private currency: CurrencyService,
    private i18n: I18nService,
  ) {}

  get mode(): ContactMode {
    return this.settings()?.contactMode ?? environment.contactMode;
  }

  get whatsappNumber(): string {
    return this.settings()?.whatsappNumber || environment.whatsappNumber;
  }

  get supportEmail(): string {
    return this.settings()?.supportEmail || environment.supportEmail;
  }

  get businessHours(): string {
    return this.settings()?.businessHours || environment.businessHours;
  }

  /**
   * Loads the admin-managed store settings once per session.
   *
   * The request is silent (a missing contact channel is not worth a global
   * error toast) and every failure is swallowed: the environment defaults
   * stay in place and the storefront keeps working offline. A failed load
   * may be retried by a later call; a successful one is never repeated.
   */
  load(): void {
    if (environment.useMockApi) {
      // No backend in mock mode: the bundled values ARE the store settings.
      this.settingsLoaded.set(true);
      return;
    }
    if (this.requested) return;
    this.requested = true;
    this.fetch();
  }

  /**
   * Re-read the store settings.
   *
   * The storefront calls this when the tab regains focus, so an administrator
   * who changed the WhatsApp number or the support email sees the change
   * without a hard reload.
   */
  refresh(): void {
    if (environment.useMockApi) return;
    this.fetch();
  }

  private fetch(): void {
    this.api
      .get<unknown>('store/settings', undefined, { silent: true })
      .pipe(catchError(() => of(null)))
      .subscribe((raw) => {
        const usable = raw !== null && typeof raw === 'object' && !Array.isArray(raw);
        if (usable) {
          const parsed = toStoreSettings(raw);
          this.settings.set({
            whatsappNumber: parsed.whatsappNumber || environment.whatsappNumber,
            supportEmail: parsed.supportEmail || environment.supportEmail,
            businessHours: parsed.businessHours || environment.businessHours,
            contactMode: parsed.contactMode ?? environment.contactMode,
          });
          // The store's default currency is the store's own setting, so the
          // storefront prices in it. A visitor who already chose a currency
          // keeps it: the choice is theirs, and it is remembered.
          if (parsed.defaultCurrency) {
            this.currency.applyStoreDefault(parsed.defaultCurrency);
          }
        } else {
          // Unreachable API or an unusable body: keep the fallback and allow
          // a later call to try again.
          this.requested = false;
        }
        this.settingsLoaded.set(true);
      });
  }

  // Order message with everything needed for fulfillment: reference, items,
  // money breakdown, hotel destination and customer contact. Includes the
  // delivery fee line explicitly — hotels charge different fees.
  buildWhatsAppMessage(order: Order): string {
    const c = order.customer;
    const lines = [
      `${this.i18n.t('confirmation.orderNumber')}: ${order.orderNumber}`,
      '',
      ...order.items.map(
        (i) =>
          `• ${i.productName}${i.variantLabel ? ` (${i.variantLabel})` : ''} × ${i.qty} — ${this.currency.format(i.unitPrice * i.qty, order.currency)}`,
      ),
      '',
      `${this.i18n.t('checkout.subtotal')}: ${this.currency.format(order.subtotal, order.currency)}`,
      `${this.i18n.t('checkout.delivery')}: ${this.currency.format(order.deliveryFee, order.currency)}`,
      `${this.i18n.t('checkout.total')}: ${this.currency.format(order.total, order.currency)}`,
      `${this.i18n.t('confirmation.cashOnDelivery')}`,
      '',
      `${c.fullName} — ${c.phone}`,
      `${c.hotelName}, ${c.city}${c.room ? ` — ${c.room}` : ''}`,
    ];
    if (c.notes) lines.push(`${c.notes}`);
    return lines.join('\n');
  }

  whatsappUrl(order: Order): string {
    const text = encodeURIComponent(this.buildWhatsAppMessage(order));
    // wa.me only understands digits: an admin-entered "+20 100 123 4567"
    // would otherwise produce a dead chat link.
    const digits = this.whatsappNumber.replace(/\D/g, '');
    return `https://wa.me/${digits || this.whatsappNumber}?text=${text}`;
  }

  openWhatsApp(order: Order): void {
    window.open(this.whatsappUrl(order), '_blank', 'noopener');
  }

  emailUrl(order: Order): string {
    const subject = encodeURIComponent(`${this.i18n.t('orders.orderNumber')} ${order.orderNumber}`);
    const body = encodeURIComponent(this.buildWhatsAppMessage(order));
    return `mailto:${this.supportEmail}?subject=${subject}&body=${body}`;
  }

  openEmail(order: Order): void {
    window.location.href = this.emailUrl(order);
  }
}
