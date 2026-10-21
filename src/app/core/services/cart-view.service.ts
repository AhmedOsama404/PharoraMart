import { Injectable, computed, effect, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CartStore } from './cart.store';
import { ProductService } from './product.service';
import { effectivePrice, type Product } from '../../models/product.model';
import { PriceResolverService } from './price-resolver.service';
import { CurrencyService } from './currency.service';

export interface EnrichedCartLine {
  key: string;
  productId: string;
  variantKey?: string;
  variantLabel?: string;
  qty: number;
  /** Null when the product no longer resolves (removed/deactivated/stale id). */
  product: Product | null;
  /** 0 when unavailable — unavailable lines never contribute to money. */
  unit: number;
  lineTotal: number;
  unavailable: boolean;
  /** The live stock of the product. 0 when the product is gone. */
  stock: number;
  /**
   * True when the stored quantity was larger than the live stock and the
   * quantity was reduced to what is actually available.
   */
  qtyAdjusted: boolean;
  /** The quantity the customer had before it was reduced (0 when untouched). */
  previousQty: number;
}

export type CartViewStatus = 'loading' | 'ready' | 'error';

/**
 * Single enrichment point for cart display: joins the authoritative raw lines
 * (CartStore) with the product catalog. Previously the cart page and checkout
 * each joined independently — and both silently dropped unresolvable lines
 * while the badge kept counting them (badge N, page empty).
 *
 * Invariants:
 * - every stored line renders exactly one row (unknown products render as
 *   explicit "unavailable" rows with a remove action, never vanish);
 * - badge (sum of all qty) always equals the sum of visible row quantities;
 * - money derives only from priced (available) lines;
 * - **a line never holds more than the live stock**: the quantity is reduced
 *   as soon as the catalog is known, so a stale cart (an old session, a
 *   device that was offline) can never be ordered beyond the stock.
 */
@Injectable({ providedIn: 'root' })
export class CartViewService {
  private catalog = signal<Product[]>([]);
  private status = signal<CartViewStatus>('loading');
  private lastRequestKey = '';
  /** key -> the quantity the customer had before it was reduced. */
  private readonly adjusted = signal<Record<string, number>>({});

  readonly ready = computed(() => this.status() !== 'loading');
  readonly failed = computed(() => this.status() === 'error');
  /** Typed failure for the shared error state; resets on every load. */
  readonly error = signal<unknown>(null);

  /** The lines whose quantity was reduced to the live stock. */
  readonly adjustedLines = computed(() => {
    const byKey = new Map(this.lines().map((l) => [l.key, l]));
    return Object.entries(this.adjusted())
      .map(([key, previousQty]) => byKey.get(key))
      .filter((l): l is EnrichedCartLine => !!l);
  });

  readonly lines = computed<EnrichedCartLine[]>(() => {
    const byId = new Map(this.catalog().map((p) => [p.id, p]));
    const adjustments = this.adjusted();
    return this.cart.lines().map((l) => {
      const product = byId.get(l.productId) ?? null;
      // Older API records and local mock products omit currency; their amount
      // is already expressed in the visitor's selected currency.
      const resolved = product
        ? this.prices.resolve(effectivePrice(product), product.currency ?? this.currency.code())
        : null;
      const stock = product?.stock ?? 0;
      if (!product || !resolved) {
        return {
          ...l,
          product,
          unit: 0,
          lineTotal: 0,
          unavailable: true,
          stock,
          qtyAdjusted: false,
          previousQty: 0,
        };
      }
      // A product that is out of stock cannot be ordered at all.
      if (stock <= 0) {
        return { ...l, product, unit: 0, lineTotal: 0, unavailable: true, stock, qtyAdjusted: false, previousQty: 0 };
      }
      const unit = resolved.amount;
      return {
        ...l,
        product,
        unit,
        lineTotal: unit * l.qty,
        unavailable: false,
        stock,
        qtyAdjusted: adjustments[l.key] !== undefined,
        previousQty: adjustments[l.key] ?? 0,
      };
    });
  });

  /** Money over available lines only. */
  readonly pricedSubtotal = computed(() => this.lines().reduce((n, l) => n + l.lineTotal, 0));

  readonly unavailableCount = computed(() => this.lines().filter((l) => l.unavailable).length);

  constructor(
    private cart: CartStore,
    private products: ProductService,
    private prices: PriceResolverService,
    private currency: CurrencyService,
  ) {
    effect((onCleanup) => {
      const ids = [...new Set(this.cart.lines().map((line) => line.productId))];
      const key = ids.join('\u001f');
      if (key === this.lastRequestKey) return;
      this.lastRequestKey = key;
      this.load(ids, onCleanup);
    });
  }

  /** (Re)loads only products represented by cart lines. Safe to retry after an error. */
  refresh(): void {
    const ids = [...new Set(this.cart.lines().map((line) => line.productId))];
    this.lastRequestKey = ids.join('\u001f');
    this.load(ids);
  }

  /**
   * Refetches prices immediately before a money action and resolves only when
   * the authoritative answer arrived. Returns false on any failure so checkout
   * can block instead of charging a stale total.
   */
  async ensureFresh(): Promise<boolean> {
    const ids = [...new Set(this.cart.lines().map((line) => line.productId))];
    if (ids.length === 0) {
      this.catalog.set([]);
      this.error.set(null);
      this.status.set('ready');
      this.applyStockLimits();
      return true;
    }
    this.lastRequestKey = ids.join('\u001f');
    this.status.set('loading');
    this.error.set(null);
    try {
      const items = await firstValueFrom(this.products.getByIdsMany(ids));
      this.catalog.set(items);
      this.applyStockLimits();
      this.status.set('ready');
      return true;
    } catch (err) {
      this.catalog.set([]);
      this.error.set(err);
      this.status.set('error');
      return false;
    }
  }

  /**
   * Reduces every line to the live stock. A cart that survived from an older
   * session (or from a device that was offline) can hold a quantity the shop
   * no longer has; the quantity is corrected here, in the store, so the badge,
   * the cart page, the checkout and the order all agree.
   */
  private applyStockLimits(): void {
    const byId = new Map(this.catalog().map((p) => [p.id, p]));
    const adjusted: Record<string, number> = {};

    for (const line of this.cart.lines()) {
      const product = byId.get(line.productId);
      if (!product) continue;
      const stock = product.stock;
      if (stock <= 0) continue;
      if (line.qty > stock) {
        adjusted[line.key] = line.qty;
        this.cart.setQty(line.key, stock, stock);
      }
    }

    if (Object.keys(adjusted).length > 0) {
      this.adjusted.set({ ...this.adjusted(), ...adjusted });
    }
  }

  private load(ids: string[], onCleanup?: (cleanupFn: () => void) => void): void {
    if (ids.length === 0) {
      this.catalog.set([]);
      this.error.set(null);
      this.status.set('ready');
      this.applyStockLimits();
      return;
    }
    this.status.set('loading');
    this.error.set(null);
    const subscription = this.products.getByIdsMany(ids).subscribe({
      next: (items) => {
        this.catalog.set(items);
        this.applyStockLimits();
        this.status.set('ready');
      },
      error: (err: unknown) => {
        // Never keep prices from a previous successful load: money must come
        // from a fresh catalog answer, otherwise checkout would show stale
        // totals while the backend is unreachable.
        this.catalog.set([]);
        this.error.set(err);
        this.status.set('error');
      },
    });
    onCleanup?.(() => subscription.unsubscribe());
  }
}
