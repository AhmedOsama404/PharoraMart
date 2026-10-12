import { TestBed } from '@angular/core/testing';
import { ContactService } from './contact.service';
import type { Order } from '../../models/order.model';

const ORDER: Order = {
  id: 'ord-1',
  orderNumber: 'NM-2026-1001',
  status: 'pending',
  createdAt: new Date().toISOString(),
  customer: {
    fullName: 'Jan Novak',
    phone: '+420777123456',
    city: 'Hurghada',
    hotelId: 'desert-rose',
    hotelName: 'Desert Rose Resort',
    room: 'Room 101',
    contactMethod: 'whatsapp',
  },
  items: [{ productId: 'p1', productName: 'Aurora Headphones', image: 'x', unitPrice: 139, qty: 1 }],
  subtotal: 139,
  deliveryFee: 0,
  total: 139,
  currency: 'USD',
  paymentMethod: 'cash_on_delivery',
};

describe('ContactService', () => {
  let svc: ContactService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(ContactService);
  });

  it('builds an encoded WhatsApp click-to-chat URL with order details', () => {
    const url = svc.whatsappUrl(ORDER);
    expect(url.startsWith('https://wa.me/')).toBeTrue();
    expect(url).toContain(encodeURIComponent('NM-2026-1001'));
    // Message content is URL-encoded, never sent automatically:
    expect(url).toContain('text=');
  });

  it('includes hotel, money breakdown and contact in the order message', () => {
    const msg = svc.buildWhatsAppMessage(ORDER);
    expect(msg).toContain('NM-2026-1001');
    expect(msg).toContain('Desert Rose Resort');
    expect(msg).toContain('Room 101');
    expect(msg).toContain('Aurora Headphones');
    expect(msg).toContain('+420777123456');
  });

  it('builds a mailto URL (opens email app, does not send)', () => {
    const url = svc.emailUrl(ORDER);
    expect(url.startsWith('mailto:')).toBeTrue();
    expect(url).toContain(encodeURIComponent('NM-2026-1001'));
  });
});
