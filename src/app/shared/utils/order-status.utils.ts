import type { OrderStatus } from '../../models/order.model';

export type StatusSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

/**
 * Order-status presentation shared by the history list and the detail page.
 * The label translator is injected by the caller (usually `i18n.t`) so this
 * utility stays framework-free and trivially unit-testable.
 */
export function orderStatusLabel(status: OrderStatus, t: (key: string) => string): string {
  return t(`orders.status${status[0].toUpperCase()}${status.slice(1)}`);
}

export function orderStatusSeverity(status: OrderStatus): StatusSeverity {
  switch (status) {
    case 'delivered':
      return 'success';
    case 'shipped':
      return 'info';
    case 'confirmed':
      return 'secondary';
    case 'cancelled':
      return 'danger';
    default:
      // 'pending' and any future unknown status land here (warn, never crash).
      return 'warn';
  }
}
