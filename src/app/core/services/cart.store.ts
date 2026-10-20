import { Injectable, computed, signal } from '@angular/core';
import { cartLineKey, type CartItem, type CartLine } from '../../models/cart.model';

const STORAGE_KEY = 'novamart.cart.v1';

/**
 * The most units of ONE product an order may hold. The store sells small
 * quantities of natural products, and a cap keeps a mis-clicked "+" from
 * turning into a huge order.
 */
export const MAX_QTY_PER_LINE = 10;

// Guest carts live in localStorage so they survive refreshes without an
// account. Stored data is untrusted: anything malformed (edited by hand,
// written by an older version) is discarded item by item instead of crashing.
function load(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((i) => i && typeof i.productId === 'string' && Number.isFinite(i.qty))
      .map((i) => ({
        productId: i.productId,
        variantKey: i.variantKey,
        variantLabel: i.variantLabel,
        // The ceiling is the same one the server uses. The real limit is the
        // live stock, and the cart view applies it as soon as the catalog is
        // known — a lower ceiling here would silently change a quantity the
        // customer never touched.
        qty: Math.max(1, Math.min(MAX_QTY_PER_LINE, Math.floor(i.qty))),
      }))
      .map((i) => ({ ...i, key: cartLineKey(i.productId, i.variantKey) }));
  } catch {
    return [];
  }
}

@Injectable({ providedIn: 'root' })
export class CartStore {
  readonly lines = signal<CartLine[]>(load());

  readonly count = computed(() => this.lines().reduce((n, l) => n + l.qty, 0));
  readonly isEmpty = computed(() => this.lines().length === 0);

  private persist(): void {
    try {
      const items: CartItem[] = this.lines().map(({ productId, variantKey, variantLabel, qty }) => ({
        productId,
        variantKey,
        variantLabel,
        qty,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }

  /** Add qty to an existing line or create it. Same product+variant never duplicates. Returns final qty. */
  add(productId: string, qty = 1, variantKey?: string, variantLabel?: string, maxStock = 9999): number {
    const key = cartLineKey(productId, variantKey);
    const safeQty = Math.max(1, Math.floor(qty));
    // The line can never hold more than the stock, nor more than the cap.
    const ceiling = Math.max(1, Math.min(maxStock, MAX_QTY_PER_LINE));
    let finalQty = safeQty;
    // Immutable update: totals and counts derive from `lines`, so there is a
    // single source of truth and no manually synced counters to drift.
    this.lines.update((lines) => {
      const existing = lines.find((l) => l.key === key);
      if (existing) {
        finalQty = Math.max(1, Math.min(ceiling, existing.qty + safeQty));
        return lines.map((l) => (l.key === key ? { ...l, qty: finalQty } : l));
      }
      finalQty = Math.max(1, Math.min(ceiling, safeQty));
      return [...lines, { key, productId, variantKey, variantLabel, qty: finalQty }];
    });
    this.persist();
    return finalQty;
  }

  setQty(key: string, qty: number, maxStock = 9999): void {
    const safe = Math.max(1, Math.min(Math.max(1, Math.min(maxStock, MAX_QTY_PER_LINE)), Math.floor(qty)));
    this.lines.update((lines) => lines.map((l) => (l.key === key ? { ...l, qty: safe } : l)));
    this.persist();
  }

  remove(key: string): void {
    this.lines.update((lines) => lines.filter((l) => l.key !== key));
    this.persist();
  }

  clear(): void {
    this.lines.set([]);
    this.persist();
  }

  /** Replaces local lines (server pull). Caps qty defensively like load(). */
  replaceAll(lines: { productId: string; variantKey?: string; variantLabel?: string; qty: number }[]): void {
    this.lines.set(
      lines
        .filter((i) => i && typeof i.productId === 'string' && i.productId.trim() !== '' && Number.isFinite(i.qty))
        .map((i) => ({
          productId: i.productId,
          variantKey: i.variantKey,
          variantLabel: i.variantLabel,
          qty: Math.max(1, Math.min(MAX_QTY_PER_LINE, Math.floor(i.qty))),
          key: cartLineKey(i.productId, i.variantKey),
        })),
    );
    this.persist();
  }

  /**
   * The guest cart combined with the account cart — as a VALUE.
   *
   * The result is never stored in the cart: it is sent to the server, and
   * the server's answer (clamped to the live stock) is what the cart
   * adopts. Merging straight into the cart is what made the quantity
   * grow on every reload.
   */
  mergedWith(lines: { productId: string; variantKey?: string; variantLabel?: string; qty: number }[]): CartLine[] {
    const merged = new Map<string, CartLine>();
    for (const line of [...this.lines(), ...(lines ?? [])]) {
      if (!line || typeof line.productId !== 'string' || line.productId.trim() === '' || !Number.isFinite(line.qty)) {
        continue;
      }
      const key = cartLineKey(line.productId, line.variantKey);
      const qty = Math.max(1, Math.min(MAX_QTY_PER_LINE, Math.floor(line.qty)));
      const existing = merged.get(key);
      merged.set(key, existing
        ? { ...existing, qty: Math.min(MAX_QTY_PER_LINE, existing.qty + qty) }
        : { ...line, qty, key });
    }
    return [...merged.values()];
  }

  qtyOf(productId: string, variantKey?: string): number {
    return this.lines().find((l) => l.key === cartLineKey(productId, variantKey))?.qty ?? 0;
  }
}
