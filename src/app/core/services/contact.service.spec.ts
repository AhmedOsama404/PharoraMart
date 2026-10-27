import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ContactService } from './contact.service';
import { environment } from '../../../environments/environment';
import type { Order } from '../../models/order.model';

const ORDER: Order = {
  id: 'ord-1',
  orderNumber: 'PM-2026-1001',
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
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(ContactService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('builds an encoded WhatsApp click-to-chat URL with order details', () => {
    const url = svc.whatsappUrl(ORDER);
    expect(url.startsWith('https://wa.me/')).toBeTrue();
    expect(url).toContain(encodeURIComponent('PM-2026-1001'));
    // Message content is URL-encoded, never sent automatically:
    expect(url).toContain('text=');
  });

  it('includes hotel, money breakdown and contact in the order message', () => {
    const msg = svc.buildWhatsAppMessage(ORDER);
    expect(msg).toContain('PM-2026-1001');
    expect(msg).toContain('Desert Rose Resort');
    expect(msg).toContain('Room 101');
    expect(msg).toContain('Aurora Headphones');
    expect(msg).toContain('+420777123456');
  });

  it('builds a mailto URL (opens email app, does not send)', () => {
    const url = svc.emailUrl(ORDER);
    expect(url.startsWith('mailto:')).toBeTrue();
    expect(url).toContain(encodeURIComponent('PM-2026-1001'));
  });
});

/**
 * The contact details are admin-managed and come from the public
 * `GET store/settings` endpoint. The bundled environment values are only the
 * fallback for an unreachable API or a store that has not filled them in yet.
 */
describe('ContactService store settings', () => {
  let svc: ContactService;
  let httpMock: HttpTestingController;
  let mockApi: boolean;

  beforeEach(() => {
    // The unit suite runs in mock mode (no backend); the store-settings path
    // is exercised here, so the live branch is enabled for this spec only.
    mockApi = environment.useMockApi;
    environment.useMockApi = false;
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(ContactService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    environment.useMockApi = mockApi;
    httpMock.verify();
  });

  it('uses the store settings instead of the bundled environment values', () => {
    svc.load();
    const req = httpMock.expectOne((r) => r.url.endsWith('/store/settings'));
    expect(req.request.method).toBe('GET');
    req.flush({
      whatsappNumber: '201099887766',
      supportEmail: 'help@pharora.example',
      businessHours: 'Daily 10:00 - 23:00',
      contactMode: 'email',
      defaultCurrency: 'EGP',
    });

    expect(svc.whatsappNumber).toBe('201099887766');
    expect(svc.supportEmail).toBe('help@pharora.example');
    expect(svc.businessHours).toBe('Daily 10:00 - 23:00');
    expect(svc.mode).toBe('email');
    expect(svc.ready()).toBeTrue();
  });

  it('falls back to the environment values when the API fails, without throwing', () => {
    expect(() => svc.load()).not.toThrow();
    httpMock
      .expectOne((r) => r.url.endsWith('/store/settings'))
      .flush('boom', { status: 500, statusText: 'Server Error' });

    expect(svc.whatsappNumber).toBe(environment.whatsappNumber);
    expect(svc.supportEmail).toBe(environment.supportEmail);
    expect(svc.businessHours).toBe(environment.businessHours);
    expect(svc.mode).toBe(environment.contactMode);
    // The storefront stays usable: the message builders keep working.
    expect(svc.whatsappUrl(ORDER)).toContain(environment.whatsappNumber);
    expect(svc.emailUrl(ORDER)).toContain(environment.supportEmail);
  });

  it('keeps the environment values for fields the store has not filled in', () => {
    svc.load();
    httpMock.expectOne((r) => r.url.endsWith('/store/settings')).flush({
      whatsappNumber: '201099887766',
      supportEmail: '',
      businessHours: null,
      contactMode: 'sms',
    });

    expect(svc.whatsappNumber).toBe('201099887766');
    expect(svc.supportEmail).toBe(environment.supportEmail);
    expect(svc.businessHours).toBe(environment.businessHours);
    expect(svc.mode).toBe(environment.contactMode);
  });
});
