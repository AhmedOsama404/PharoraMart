import { toOrder } from './order.mapper';
import type { BackendOrder } from './order.mapper';

describe('order.mapper', () => {
  const backend: BackendOrder = {
    id: 'ord-1',
    orderNumber: 'PM-2026-1001',
    customer: {
      fullName: 'Sandy Tourist',
      phone: '+420777123456',
      email: 'sandy@example.com',
      city: 'Hurghada',
      hotelId: 'desert-rose',
      hotelName: 'Desert Rose Resort',
      room: '101',
      notes: 'two bags',
      contactMethod: 'whatsapp',
    },
    items: [{ productId: 'argan-oil', productName: 'Argan Oil', image: 'a.jpg', unitPrice: 19, qty: 2, variantLabel: '100 ml' }],
    subtotal: 38,
    deliveryFee: 8,
    total: 46,
    currency: 'USD',
    paymentMethod: 'cash_on_delivery',
    status: 'pending',
    createdAt: '2026-06-02T10:00:00Z',
    userId: 'user-1',
  };

  it('maps customer, items, money and server enums onto the frontend Order', () => {
    const o = toOrder(backend);
    expect(o.id).toBe('ord-1');
    expect(o.orderNumber).toBe('PM-2026-1001');
    expect(o.customer.phone).toBe('+420777123456');
    expect(o.customer.room).toBe('101');
    expect(o.items[0].unitPrice).toBe(19);
    expect(o.total).toBe(46);
    expect(o.status).toBe('pending');
    expect(o.paymentMethod).toBe('cash_on_delivery');
    expect(o.userId).toBe('user-1');
  });

  it('null-guards optional customer fields and item variantLabel', () => {
    const o = toOrder({
      ...backend,
      customer: { ...backend.customer, email: null, room: null, notes: null },
      items: [{ ...backend.items[0], variantLabel: null }],
      userId: null,
    });
    expect(o.customer.email).toBeUndefined();
    expect(o.customer.room).toBeUndefined();
    expect(o.items[0].variantLabel).toBeUndefined();
    expect(o.userId).toBeUndefined();
  });
});
