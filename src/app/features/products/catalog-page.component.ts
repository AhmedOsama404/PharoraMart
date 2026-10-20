import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Chip } from 'primeng/chip';
import { Drawer } from 'primeng/drawer';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Slider } from 'primeng/slider';
import { MAX_CATALOG_PRICE } from '../../data-access/mock-data';
import { I18nService } from '../../core/services/i18n.service';
import { CurrencyService } from '../../core/services/currency.service';
import { PriceResolverService } from '../../core/services/price-resolver.service';
import { ProductService } from '../../core/services/product.service';
import { CartStore } from '../../core/services/cart.store';
import { FavoritesStore } from '../../core/services/favorites.store';
import { NotificationService } from '../../core/services/notification.service';
import { PendingActionService } from '../../core/services/pending-action.service';
import { ScrollService } from '../../core/services/scroll.service';
import type { Availability, CatalogQuery, Category, Product, SortKey } from '../../models/product.model';
import { environment } from '../../../environments/environment';
import { ProductCardComponent } from '../../shared/components/product-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ConnectivityService } from '../../core/resilience/connectivity.service';

interface SortOption {
  label: string;
  value: SortKey;
}

@Component({
  selector: 'app-catalog-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, NgTemplateOutlet, FormsModule, Button, Checkbox, Chip, Drawer, IconField, InputIcon, InputText,
    Paginator, Select, Skeleton, Slider, ProductCardComponent, EmptyStateComponent,
  ],
  templateUrl: './catalog-page.component.html',
  styleUrl: './catalog-page.component.scss',
})
export class CatalogPageComponent implements OnInit, OnDestroy {
  protected i18n = inject(I18nService);
  protected currency = inject(CurrencyService);
  private prices = inject(PriceResolverService);
  private products = inject(ProductService);
  private cart = inject(CartStore);
  private favorites = inject(FavoritesStore);
  private notify = inject(NotificationService);
  private gate = inject(PendingActionService);
  private scroll = inject(ScrollService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected maxPrice = Math.ceil(MAX_CATALOG_PRICE / 50) * 50;
  protected priceConversionAvailable = computed(() =>
    this.prices.convert(1, this.currency.code(), 'USD') != null,
  );
  protected filterCurrency = computed(() =>
    this.priceConversionAvailable() ? this.currency.code() : 'USD',
  );
  protected displayPriceLimit = computed(() =>
    this.prices.convert(this.maxPrice, 'USD', this.filterCurrency()) ?? this.maxPrice,
  );
  protected displayPriceStep = computed(() => Math.max(1, Math.round(this.displayPriceLimit() / 100)));
  protected pageSize = environment.pageSize;
  protected drawer = signal(false);
  protected minPriceInput = signal<number | string>(0);
  protected maxPriceInput = signal<number | string>('');
  protected priceInputPending = signal(false);

  // Draft filter state. Applied to the URL (debounced for search) so listings
  // stay bookmarkable and survive refresh/back-forward navigation.
  //
  // Price bounds live in the VISITOR'S SELECTED CURRENCY — exactly what the
  // slider, the two number fields and the chips show. The only conversion to
  // the server's USD contract happens in `currentQuery()`, so UI and applied
  // state can never disagree. `maxPrice: null` means "no upper bound".
  protected draft = {
    q: signal(''),
    category: signal(''),
    minPrice: signal(0),
    maxPrice: signal<number | null>(null),
    availability: signal<'all' | Availability>('all'),
    sale: signal(false),
    sort: signal<SortKey>('recommended'),
  };

  protected items = signal<Product[]>([]);
  protected total = signal(0);
  protected page = signal(1);
  protected state = signal<'loading' | 'ok' | 'error'>('loading');
  /** True after 3 s of loading, so a slow backend is explained, not hidden. */
  protected slow = signal(false);
  private slowTimer: ReturnType<typeof setTimeout> | null = null;
  // Active categories from the data source (drives the filter, never hardcoded).
  protected categories = signal<Category[]>([]);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private priceInputTimer: ReturnType<typeof setTimeout> | null = null;
  private syncingFromUrl = false;
  private connectivity = inject(ConnectivityService);
  /** One automatic refetch per outage; a second failure waits for the user. */
  private autoRetried = false;

  /** Currency of the price bounds before the latest currency switch. */
  private lastPriceCurrency: string | null = null;

  constructor() {
    effect(() => {
      const code = this.currency.code();
      // Track rate arrival too: once conversion is possible the (empty-form)
      // upper field should show the catalog ceiling in the selected currency.
      this.displayPriceLimit();
      const pending = this.priceInputPending();
      untracked(() => this.onPriceCurrencyChanged(code, pending));
      this.trackSlowHint(this.state() === 'loading' || pending);
    });
    this.connectivity.recovered$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (this.state() === 'error' && !this.autoRetried) {
          this.autoRetried = true;
          this.reload();
        }
      });
  }

  /**
   * Keeps the price UI bounded to one source of truth: the draft in the
   * selected currency. On a currency switch the bounds' MEANING is preserved
   * by pivoting through USD ("≤ 200 EGP" stays "≤ 200 EGP-worth") and the
   * form, chips, URL and product list re-apply automatically. Values are
   * never converted back and forth while the visitor is mid-typing.
   */
  private onPriceCurrencyChanged(code: string, pending: boolean): void {
    const previous = this.lastPriceCurrency;
    this.lastPriceCurrency = code;
    let rebound = false;
    if (previous !== null && previous !== code && this.filterCurrency() !== 'USD') {
      this.draft.minPrice.set(this.pivotPrice(this.draft.minPrice(), previous, this.filterCurrency()));
      this.draft.maxPrice.set(
        this.draft.maxPrice() === null ? null : this.pivotPrice(this.draft.maxPrice()!, previous, this.filterCurrency()),
      );
      rebound = true;
    }
    if (!pending) {
      this.minPriceInput.set(this.draft.minPrice());
      this.maxPriceInput.set(this.draft.maxPrice() ?? this.displayPriceLimit());
    }
    if (rebound) this.refresh();
  }

  /** Re-expresses a bound in another currency via the USD pivot. */
  private pivotPrice(amount: number, from: string, to: string): number {
    if (from === to) return amount;
    const usd = this.prices.convertPrecise(amount, from, 'USD');
    if (usd == null) return amount;
    return this.prices.convert(usd, 'USD', to) ?? amount;
  }

  /** Explicit Retry: reset the breaker, probe health, refetch immediately. */
  protected retry(): void {
    this.autoRetried = true;
    this.connectivity.retryNow();
    this.reload();
  }

  ngOnDestroy(): void {
    this.clearSlowTimer();
  }

  private trackSlowHint(busy: boolean): void {
    if (!busy) {
      this.clearSlowTimer();
      this.slow.set(false);
      return;
    }
    if (this.slowTimer) return;
    this.slow.set(false);
    this.slowTimer = setTimeout(() => {
      this.slowTimer = null;
      this.slow.set(true);
    }, 3000);
  }

  private clearSlowTimer(): void {
    if (this.slowTimer) {
      clearTimeout(this.slowTimer);
      this.slowTimer = null;
    }
  }

  // Memoized option lists keep stable references for PrimeNG selects.
  protected sortOptions = computed<SortOption[]>(() => [
    { label: this.i18n.t('catalog.sortRecommended'), value: 'recommended' },
    { label: this.i18n.t('catalog.sortNewest'), value: 'newest' },
    { label: this.i18n.t('catalog.sortPriceAsc'), value: 'price_asc' },
    { label: this.i18n.t('catalog.sortPriceDesc'), value: 'price_desc' },
    { label: this.i18n.t('catalog.sortNameAsc'), value: 'name_asc' },
    { label: this.i18n.t('catalog.sortBestselling'), value: 'bestselling' },
  ]);

  protected categoryOptions = computed(() => [
    { label: this.i18n.t('catalog.allCategories'), value: '' },
    // Rendered from the data source (active categories only), never hardcoded:
    // the future dashboard can add, rename or deactivate categories freely.
    ...this.categories().map((c) => ({ label: this.products.categoryLabel(c), value: c.id })),
  ]);

  protected availOptions = computed(() => [
    { label: this.i18n.t('catalog.allAvailability'), value: 'all' },
    { label: this.i18n.t('catalog.inStock'), value: 'in_stock' },
    { label: this.i18n.t('catalog.lowStock'), value: 'low_stock' },
    { label: this.i18n.t('catalog.outOfStock'), value: 'out_of_stock' },
  ]);

  protected activeChips = computed(() => {
    const chips: { key: string; label: string }[] = [];
    if (this.draft.q()) chips.push({ key: 'q', label: `“${this.draft.q()}”` });
    if (this.draft.category()) chips.push({ key: 'category', label: this.products.categoryName(this.draft.category()!) });
    if (this.draft.minPrice() > 0) chips.push({ key: 'min', label: `≥ ${this.currency.format(this.draft.minPrice(), this.filterCurrency())}` });
    if (this.draft.maxPrice() !== null) chips.push({ key: 'max', label: `≤ ${this.currency.format(this.draft.maxPrice()!, this.filterCurrency())}` });
    if (this.draft.availability() !== 'all') chips.push({ key: 'avail', label: this.draft.availability() });
    if (this.draft.sale()) chips.push({ key: 'sale', label: this.i18n.t('catalog.onSaleOnly') });
    return chips;
  });

  ngOnInit(): void {
    // Filter categories come from the data source, independent of products.
    // A failed category request must not become an unhandled error and must
    // not block the product list: fall back to "All categories".
    this.products.categories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => this.categories.set([]),
    });
    // The URL is the source of truth: every query-param change rebuilds the
    // draft and reloads, which keeps back/forward and bookmarks consistent.
    // First entry lands at the top (like every fresh page); later emissions
    // are in-page filter/pagination work, where the viewport must stay put.
    let firstEntry = true;
    this.route.queryParamMap.subscribe((params) => {
      this.syncingFromUrl = true;
      this.draft.q.set(params.get('q') ?? '');
      this.draft.category.set(params.get('category') ?? '');
      // Price params are numbers in the CURRENTLY SELECTED currency, matching
      // what the controls show. An absent `max` means "no upper bound".
      this.draft.minPrice.set(Math.max(0, Number(params.get('min') ?? 0) || 0));
      const maxParam = params.get('max');
      const maxNumber = maxParam == null || maxParam === '' ? Number.NaN : Number(maxParam);
      this.draft.maxPrice.set(Number.isFinite(maxNumber) ? maxNumber : null);
      if (!this.priceInputPending()) {
        this.minPriceInput.set(this.draft.minPrice());
        this.maxPriceInput.set(this.draft.maxPrice() ?? this.displayPriceLimit());
      }
      this.draft.availability.set((params.get('avail') as 'all' | Availability) ?? 'all');
      this.draft.sale.set(params.get('sale') === '1');
      this.draft.sort.set((params.get('sort') as SortKey) ?? 'recommended');
      this.page.set(Number(params.get('page') ?? 1) || 1);
      this.syncingFromUrl = false;
      this.reload();
      if (firstEntry) {
        firstEntry = false;
        this.scroll.scrollToTop();
      }
    });
  }

  private currentQuery(): CatalogQuery {
    // Single conversion point: the visitor's bounds go to the server's USD
    // contract here and nowhere else. An unusable rate simply omits a bound
    // instead of guessing a meaning for the typed number.
    const filterCurrency = this.filterCurrency();
    const minUsd = this.draft.minPrice() > 0
      ? this.prices.convertPrecise(this.draft.minPrice(), filterCurrency, 'USD')
      : null;
    const maxUsd = this.draft.maxPrice() !== null
      ? this.prices.convertPrecise(this.draft.maxPrice()!, filterCurrency, 'USD')
      : null;
    return {
      search: this.draft.q() || undefined,
      categoryId: this.draft.category() || undefined,
      minPrice: minUsd ?? undefined,
      maxPrice: maxUsd ?? undefined,
      availability: this.draft.availability(),
      onSaleOnly: this.draft.sale() || undefined,
      sort: this.draft.sort(),
      page: this.page(),
      pageSize: this.pageSize,
    };
  }

  private pushUrl(): void {
    if (this.syncingFromUrl) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.draft.q() || null,
        category: this.draft.category() || null,
        min: this.draft.minPrice() || null,
        max: this.draft.maxPrice(),
        priceMode: null,
        avail: this.draft.availability() !== 'all' ? this.draft.availability() : null,
        sale: this.draft.sale() ? 1 : null,
        sort: this.draft.sort() !== 'recommended' ? this.draft.sort() : null,
        page: this.page() > 1 ? this.page() : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected reload(): void {
    this.state.set('loading');
    this.products.list(this.currentQuery()).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.autoRetried = false;
        this.state.set('ok');
      },
      error: () => this.state.set('error'),
    });
  }

  private refresh(): void {
    // Any filter change restarts at page 1 — deeper pages may not exist anymore.
    this.page.set(1);
    this.pushUrl();
    this.reload();
  }

  protected onSearchType(): void {
    // Debounce typing so each keystroke doesn't push a URL + request.
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.refresh(), 350);
  }

  protected setSort(v: SortKey): void {
    this.draft.sort.set(v);
    this.refresh();
  }

  protected setCategory(v: string): void {
    this.draft.category.set(v);
    this.refresh();
  }

  protected setMaxPrice(v: number | string | number[] | undefined): void {
    if (!this.priceConversionAvailable()) return;
    const n = Array.isArray(v) ? v[0] : Number(v);
    if (!Number.isFinite(n)) return;
    const limit = this.displayPriceLimit();
    const displayValue = Math.max(0, Math.min(limit, n));
    // Reaching the catalog ceiling means "no upper bound" again.
    const maxValue = displayValue >= limit ? null : displayValue;
    const nextMax = maxValue === null ? null : Math.max(this.draft.minPrice(), maxValue);
    const changed = nextMax !== this.draft.maxPrice();
    this.draft.maxPrice.set(nextMax);
    this.maxPriceInput.set(nextMax ?? '');
    if (changed) this.refresh();
  }

  protected onPriceInput(bound: 'min' | 'max', value: number | string): void {
    if (bound === 'min') this.minPriceInput.set(value);
    else this.maxPriceInput.set(value);
    this.priceInputPending.set(true);
    if (this.priceInputTimer) clearTimeout(this.priceInputTimer);
    this.priceInputTimer = setTimeout(() => {
      this.priceInputTimer = null;
      this.applyPriceRange();
    }, 350);
  }

  protected applyPriceRange(): void {
    if (this.priceInputTimer) clearTimeout(this.priceInputTimer);
    this.priceInputTimer = null;

    const minRaw = String(this.minPriceInput()).trim();
    const maxRaw = String(this.maxPriceInput()).trim();
    // An emptied field clears its bound; numbers mean the selected currency.
    const minDisplay = minRaw === '' ? 0 : Number(minRaw);
    const maxDisplay: number | null = maxRaw === '' ? null : Number(maxRaw);
    if (
      !Number.isFinite(minDisplay) ||
      (maxDisplay !== null && !Number.isFinite(maxDisplay)) ||
      !this.priceConversionAvailable()
    ) {
      // Unusable input or no usable rate: refuse to apply a guessed meaning.
      this.priceInputPending.set(false);
      return;
    }

    const limit = this.displayPriceLimit();
    const nextMin = Math.max(0, Math.min(limit, minDisplay));
    const nextMax = maxDisplay === null ? null : Math.max(nextMin, Math.min(limit, maxDisplay));
    const changed = nextMin !== this.draft.minPrice() || nextMax !== this.draft.maxPrice();
    this.draft.minPrice.set(nextMin);
    this.draft.maxPrice.set(nextMax);
    // Echo the normalized values so the form never lies about what is applied
    // (e.g. a value beyond the catalog ceiling snaps back to the ceiling).
    this.minPriceInput.set(nextMin);
    this.maxPriceInput.set(nextMax ?? '');
    this.priceInputPending.set(false);
    if (changed) this.refresh();
  }

  protected setAvail(v: 'all' | Availability): void {
    this.draft.availability.set(v);
    this.refresh();
  }

  protected setSale(v: boolean | undefined): void {
    this.draft.sale.set(!!v);
    this.refresh();
  }

  protected onPage(ev: PaginatorState): void {
    if (ev.rows) this.pageSize = ev.rows;
    this.page.set((ev.page ?? 0) + 1);
    this.pushUrl();
    this.reload();
    // The result list genuinely moved: smooth-scroll back to it.
    this.scroll.scrollToTop('smooth');
  }

  protected removeChip(key: string): void {
    if (key === 'q') this.draft.q.set('');
    if (key === 'category') this.draft.category.set('');
    if (key === 'min') this.draft.minPrice.set(0);
    if (key === 'max') this.draft.maxPrice.set(null);
    if (key === 'avail') this.draft.availability.set('all');
    if (key === 'sale') this.draft.sale.set(false);
    this.refresh();
  }

  protected clearAll(): void {
    if (this.priceInputTimer) clearTimeout(this.priceInputTimer);
    this.priceInputTimer = null;
    this.priceInputPending.set(false);
    this.draft.q.set('');
    this.draft.category.set('');
    this.draft.minPrice.set(0);
    this.draft.maxPrice.set(null);
    this.draft.availability.set('all');
    this.draft.sale.set(false);
    this.draft.sort.set('recommended');
    this.drawer.set(false);
    this.refresh();
  }

  protected addToCart({ product: p, quantity }: { product: Product; quantity: number }): void {
    if (!this.gate.requireAuth('addToCart', this.router.url, { kind: 'add-to-cart', productId: p.id, qty: quantity })) return;
    this.cart.add(p.id, quantity, undefined, undefined, p.stock);
    this.notify.success('notifications.addedToCart');
  }

  protected toggleFav(p: Product): void {
    if (!this.gate.requireAuth('addToFavorites', this.router.url, { kind: 'add-to-favorite', productId: p.id })) return;
    const nowFav = this.favorites.toggle(p.id);
    this.notify.success(nowFav ? 'notifications.addedToFav' : 'notifications.removedFromFav');
  }
}
