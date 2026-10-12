import { orderStatusLabel, orderStatusSeverity } from './order-status.utils';

describe('order-status.utils', () => {
  const t = (key: string) => `[${key}]`;

  it('labels every known status', () => {
    expect(orderStatusLabel('pending', t)).toBe('[orders.statusPending]');
    expect(orderStatusLabel('confirmed', t)).toBe('[orders.statusConfirmed]');
    expect(orderStatusLabel('shipped', t)).toBe('[orders.statusShipped]');
    expect(orderStatusLabel('delivered', t)).toBe('[orders.statusDelivered]');
    expect(orderStatusLabel('cancelled', t)).toBe('[orders.statusCancelled]');
  });

  it('maps severities without crashing on unknown values', () => {
    expect(orderStatusSeverity('delivered')).toBe('success');
    expect(orderStatusSeverity('shipped')).toBe('info');
    expect(orderStatusSeverity('confirmed')).toBe('secondary');
    expect(orderStatusSeverity('cancelled')).toBe('danger');
    expect(orderStatusSeverity('pending')).toBe('warn');
  });
});
