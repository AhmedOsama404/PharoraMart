import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import type { Order } from '../../models/order.model';
import { CurrencyService } from './currency.service';
import { I18nService } from './i18n.service';

/**
 * Contact adapter — prepares (but never sends) external messages.
 * WhatsApp uses the official wa.me click-to-chat URL; email uses mailto:.
 * Real delivery requires a backend provider (see docs/API_CONTRACT.md).
 */
@Injectable({ providedIn: 'root' })
export class ContactService {
  constructor(
    private currency: CurrencyService,
    private i18n: I18nService,
  ) {}

  get mode(): 'whatsapp' | 'email' | 'both' {
    return environment.contactMode;
  }

  get whatsappNumber(): string {
    return environment.whatsappNumber;
  }

  get supportEmail(): string {
    return environment.supportEmail;
  }

  get businessHours(): string {
    return environment.businessHours;
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
    return `https://wa.me/${this.whatsappNumber}?text=${text}`;
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
