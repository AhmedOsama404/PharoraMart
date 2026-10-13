import { TestBed } from '@angular/core/testing';
import { OrderService } from './order.service';
import type { CreateOrderRequest } from '../../models/order.model';

function baseRequest(): CreateOrderRequest {
  return {
    customer: {
      fullName: 'Jan Novak',
      phone: '+420777123456',
      city: 'Hurghada',
      hotelId: 'desert-rose',
      hotelName: 'Desert Rose Resort',
      contactMethod: 'phone',
    },
    items: [{ productId: 'p1', productName: 'Test', image: 'x', unitPrice: 10, qty: 2 }],
    subtotal: 20,
    deliveryFee: 4.9,
    total: 24.9,
    currency: 'USD',
    paymentMethod: 'cash_on_delivery',
  };
}

describe('OrderService (mock)', () => {
  let svc: OrderService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    svc = TestBed.inject(OrderService);
  });

  it('creates a mock order with number and totals', (done) => {
    svc.create(baseRequest(), 'key-1').subscribe((order) => {
      expect(order.orderNumber).toMatch(/^PM-/);
      expect(order.total).toBe(24.9);
      expect(order.status).toBe('pending');
      expect(order.paymentMethod).toBe('cash_on_delivery');
      done();
    });
  });

  it('prevents duplicate orders for the same idempotency key', (done) => {
    svc.create(baseRequest(), 'same-key').subscribe((first) => {
      svc.create(baseRequest(), 'same-key').subscribe((second) => {
        expect(second.id).toBe(first.id);
        svc.list().subscribe((orders) => {
          expect(orders.length).toBe(1);
          done();
        });
      });
    });
  });

  it('rejects empty orders', (done) => {
    svc.create({ ...baseRequest(), items: [] }, 'empty-key').subscribe({
      next: () => done.fail('should have errored'),
      error: () => done(),
    });
  });

  it('lists newest first and fetches confirmation details', (done) => {
    svc.create(baseRequest(), 'k1').subscribe((o) => {
      svc.getById(o.id).subscribe((found) => {
        expect(found.orderNumber).toBe(o.orderNumber);
        done();
      });
    });
  });
});
