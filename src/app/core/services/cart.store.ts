import { Injectable, computed, signal } from '@angular/core';
import { cartLineKey, type CartItem, type CartLine } from '../../models/cart.model';

const STORAGE_KEY = 'novamart.cart.v1';

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
        qty: Math.max(1, Math.min(99, Math.floor(i.qty))),
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
  add(productId: string, qty = 1, variantKey?: string, variantLabel?: string, maxStock = 99): number {
    const key = cartLineKey(productId, variantKey);
    const safeQty = Math.max(1, Math.floor(qty));
    let finalQty = safeQty;
    // Immutable update: totals and counts derive from `lines`, so there is a
    // single source of truth and no manually synced counters to drift.
    this.lines.update((lines) => {
      const existing = lines.find((l) => l.key === key);
      if (existing) {
        finalQty = Math.max(1, Math.min(maxStock, existing.qty + safeQty));
        return lines.map((l) => (l.key === key ? { ...l, qty: finalQty } : l));
      }
      finalQty = Math.max(1, Math.min(maxStock, safeQty));
      return [...lines, { key, productId, variantKey, variantLabel, qty: finalQty }];
    });
    this.persist();
    return finalQty;
  }

  setQty(key: string, qty: number, maxStock = 99): void {
    const safe = Math.max(1, Math.min(maxStock, Math.floor(qty)));
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

  qtyOf(productId: string, variantKey?: string): number {
    return this.lines().find((l) => l.key === cartLineKey(productId, variantKey))?.qty ?? 0;
  }
}
