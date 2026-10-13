import { Injectable, signal } from '@angular/core';
import { delay, Observable, of, throwError } from 'rxjs';
import type { CreateOrderRequest, Order } from '../../models/order.model';

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
 * Mock order service — simulates order creation locally.
 * Duplicate submissions are guarded by idempotency key in the checkout page.
 */
@Injectable({ providedIn: 'root' })
export class OrderService {
  /** Simulated network state for QA of loading/duplicate guards. */
  readonly placing = signal(false);

  list(): Observable<Order[]> {
    const orders = [...readOrders()].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return of(orders).pipe(delay(350));
  }

  getById(id: string): Observable<Order> {
    const found = readOrders().find((o) => o.id === id || o.orderNumber === id);
    if (!found) return throwError(() => new Error('not-found')).pipe(delay(250));
    return of(found).pipe(delay(250));
  }

  create(req: CreateOrderRequest, idempotencyKey: string, userId?: string): Observable<Order> {
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
