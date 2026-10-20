import { Injectable, computed, signal } from '@angular/core';
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
 * - money derives only from priced (available) lines.
 */
@Injectable({ providedIn: 'root' })
export class CartViewService {
  private catalog = signal<Product[]>([]);
  private status = signal<CartViewStatus>('loading');

  readonly ready = computed(() => this.status() !== 'loading');
  readonly failed = computed(() => this.status() === 'error');

  readonly lines = computed<EnrichedCartLine[]>(() => {
    const byId = new Map(this.catalog().map((p) => [p.id, p]));
    return this.cart.lines().map((l) => {
      const product = byId.get(l.productId) ?? null;
      // Older API records and local mock products omit currency; their amount
      // is already expressed in the visitor's selected currency.
      const resolved = product
        ? this.prices.resolve(effectivePrice(product), product.currency ?? this.currency.code())
        : null;
      if (!product || !resolved) {
        return { ...l, product, unit: 0, lineTotal: 0, unavailable: true };
      }
      const unit = resolved.amount;
      return { ...l, product, unit, lineTotal: unit * l.qty, unavailable: false };
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
    this.refresh();
  }

  /** (Re)loads the catalog snapshot. Safe to call for retry after an error. */
  refresh(): void {
    this.status.set('loading');
    this.products.all().subscribe({
      next: (items) => {
        this.catalog.set(items);
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }
}
