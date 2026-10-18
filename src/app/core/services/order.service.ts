import { Injectable, signal } from '@angular/core';
import { delay, map, Observable, of, throwError } from 'rxjs';
import type { CreateOrderRequest, Order } from '../../models/order.model';
import { environment } from '../../../environments/environment';
import { ApiClientService } from '../api/api-client.service';
import { toOrder, type BackendOrder, type BackendPagedOrder } from '../api/order.mapper';

const ORDERS_KEY = 'novamart.orders.v1';

function readOrders(): Order[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? (arr as Order[]) : [];
  } catch {
    return [];
  }
}

function writeOrders(orders: Order[]): void {
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  } catch {
    /* ignore */
  }
}

/**
 * Customer orders. Mock mode simulates locally; live mode calls the backend,
 * which recomputes totals, validates stock/coupons and decrements inventory.
 * Duplicate submissions are guarded by idempotency key in the checkout page.
 */
@Injectable({ providedIn: 'root' })
export class OrderService {
  /** Simulated network state for QA of loading/duplicate guards. */
  readonly placing = signal(false);

  constructor(private api: ApiClientService) {}

  list(): Observable<Order[]> {
    if (!environment.useMockApi) {
      return this.api
        .get<BackendPagedOrder>('orders', { page: 1, pageSize: 50 })
        .pipe(map((res) => res.items.map(toOrder)));
    }
    const orders = [...readOrders()].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return of(orders).pipe(delay(350));
  }

  getById(id: string): Observable<Order> {
    if (!environment.useMockApi) {
      return this.api.get<BackendOrder>(`orders/${encodeURIComponent(id)}`).pipe(map(toOrder));
    }
    const found = readOrders().find((o) => o.id === id || o.orderNumber === id);
    if (!found) return throwError(() => new Error('not-found')).pipe(delay(250));
    return of(found).pipe(delay(250));
  }

  create(req: CreateOrderRequest, idempotencyKey: string, userId?: string): Observable<Order> {
    if (!environment.useMockApi) {
      // Server is authoritative for money, stock and coupons; client totals
      // are cross-checked input. The userId travels in the JWT, not the body.
      // `silent` because checkout renders the exact, localized reason inline
      // (coupon already used, out of stock, …) instead of a generic toast.
      return this.api
        .post<BackendOrder>('orders', req, { 'Idempotency-Key': idempotencyKey }, { silent: true })
        .pipe(map(toOrder));
    }
    if (!req.items.length) {
      return throwError(() => new Error('empty-order')).pipe(delay(300));
    }
    const existing = readOrders().find(
      (o) => (o as Order & { idempotencyKey?: string }).idempotencyKey === idempotencyKey,
    );
    if (existing) return of(existing).pipe(delay(300));

    const seq = readOrders().length + 1;
    const order = {
      ...req,
      id: `ord-${Date.now().toString(36)}`,
      orderNumber: `PM-${new Date().getFullYear()}-${String(1000 + seq)}`,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      userId,
      idempotencyKey,
    } as Order & { idempotencyKey: string };
    writeOrders([order, ...readOrders()]);
    return of(order).pipe(delay(900));
  }
}
