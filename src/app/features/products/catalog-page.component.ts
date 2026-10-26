import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit, computed, effect, inject, signal, untracked, type WritableSignal } from '@angular/core';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
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
import { Slider, type SliderChangeEvent, type SliderSlideEndEvent } from 'primeng/slider';
import { EMPTY, Subject, catchError, fromEvent, switchMap, tap } from 'rxjs';
import {
  catalogQueryParams,
  lastPageFor,
  niceCeil,
  niceStep,
  parseCatalogFilters,
  type CatalogFilterState,
} from './catalog-query.utils';
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

/**
 * A handle position as the field would state it. PrimeNG snaps the value onto
 * the rail's step, and that arithmetic leaves noise — 40 × 0.01 is not exactly
 * 0.4 — which in a money field reads as a number nobody could have typed.
 */
function snapRail(value: number): number {
  return Number(Math.max(0, value).toPrecision(12));
}

/**
 * How far one arrow key steps on a right-to-left axis, where the low end is on
 * the right: the mirror of what PrimeNG's handler assumes.
 */
const RTL_ARROW_STEP: Readonly<Record<string, number>> = { ArrowLeft: 1, ArrowRight: -1 };

/** The raw text one price field holds; a cleared field reads as empty. */
function fieldText(value: number | string | null): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

/**
 * A typed price bound read the way the visitor means it.
 *
 * Both decimal marks work ("12,5" is twelve and a half) and a second mark is
 * read as a thousands group ("1,234.56"), because a bound is a plain amount and
 * every locale on this storefront types fractions differently. Arabic-Indic and
 * Extended digits are folded to ASCII so an Arabic keyboard is not second-class.
 * Anything that is not a number yields `null`, so the form can say so instead
 * of guessing a meaning for the text.
 */
function parseAmount(raw: string): number | null {
  const digits = raw
    // Arabic-Indic (٠-٩) and Extended (۰-۹) blocks both start on a 16 boundary,
    // so the low nibble is the digit.
    .replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) % 16))
    .replace(/\u066B/g, '.')
    .replace(/\u066C/g, '');
  const text = digits.replace(/\s/g, '');
  if (text === '') return 0;
  const commaIsDecimal = text.lastIndexOf(',') > text.lastIndexOf('.');
  const normalized = commaIsDecimal
    ? text.replace(/\./g, '').replace(',', '.')
    : text.replace(/,/g, '');
  // An optional sign, digits, and at most one decimal mark with digits on at
  // least one side: "1e3", "12.5.7" and "--4" are mistakes, not amounts.
  if (!/^[+-]?\d*(\.\d*)?$/.test(normalized) || !/\d/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
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

  /** Bounds are only meaningful once a rate exists to translate them. */
  protected priceConversionAvailable = computed(() =>
    this.prices.convert(1, this.currency.code(), 'USD') != null,
  );
  protected filterCurrency = computed(() =>
    this.priceConversionAvailable() ? this.currency.code() : 'USD',
  );
  /**
   * The catalogue's priciest product, as the API states it (USD). It decides
   * only how long the price rail is — never what may be typed. `null` while
   * the request is in flight, in mock mode, or if it fails.
   */
  private catalogCeiling = signal<{ amount: number; currency: string } | null>(null);
  /**
   * The rail's axis top in the visitor's currency: the catalogue ceiling
   * rounded up to a number a shopper would say out loud, then grown to fit a
   * bound already typed above it. Null means no rail — the two fields need no
   * scale to work, so an unanswered catalogue draws nothing rather than a
   * scale invented from a guess.
   */
  protected priceRailMax = computed<number | null>(() => {
    const ceiling = this.catalogCeiling();
    if (ceiling === null) return null;
    const inFilter = this.pivotPrice(ceiling.amount, ceiling.currency, this.filterCurrency());
    const wanted = Math.max(inFilter, this.draft.minPrice(), this.draft.maxPrice() ?? 0);
    return wanted > 0 ? niceCeil(wanted) : null;
  });
  /** About 60 stops across the axis, so a fraction such as 0.33 is one drag away. */
  protected priceRailStep = computed(() => niceStep(this.priceRailMax() ?? 0));
  /** Handle positions the rail should show. */
  protected priceRailValue = signal<number[]>([0, 0]);
  protected priceRailMinLabel = computed(() => this.currency.format(0, this.filterCurrency()));
  protected priceRailMaxLabel = computed(() => {
    const ceiling = this.priceRailMax();
    return ceiling === null ? '' : this.currency.format(ceiling, this.filterCurrency());
  });
  /**
   * The suffix both fields wear. It is the locale's own symbol in the locale's
   * own position, so an Arabic shopper reads "ج.م." here exactly as on the
   * rail and in the chips, and an English one reads "$" in front of the amount.
   */
  protected priceCurrency = computed(() => this.currency.symbolPlacement(this.filterCurrency()));
  /**
   * PrimeNG reads `aria-valuenow` in range mode from a `value` it never fills
   * (the handles live in `values`), so it announces nothing — the pass-through
   * carries the real bound and names what the axis top means.
   */
  protected priceRailPt = computed(() => {
    const ceiling = this.priceRailMax();
    const [min, max] = this.priceRailValue();
    const text = (amount: number) => this.currency.format(amount, this.filterCurrency());
    return {
      startHandler: {
        'aria-label': this.i18n.t('catalog.minPriceLabel'),
        'aria-valuenow': min,
        'aria-valuetext': min > 0 ? text(min) : this.i18n.t('catalog.noMinPrice'),
      },
      endHandler: {
        'aria-label': this.i18n.t('catalog.maxPriceLabel'),
        'aria-valuenow': max,
        'aria-valuetext':
          ceiling === null || max >= ceiling ? this.i18n.t('catalog.noMaxPrice') : text(max),
      },
    };
  });
  protected pageSize = signal(environment.pageSize);
  protected drawer = signal(false);
  /**
   * The two fields hold the raw text while the visitor types. Both start
   * empty: a `0` printed in a box reads as content to a shopper who has typed
   * nothing, and an empty minimum is the truth — `applyPriceRange` already
   * treats '' as "no lower bound".
   */
  protected minPriceInput = signal<number | string | null>('');
  protected maxPriceInput = signal<number | string | null>('');
  protected priceInputPending = signal(false);
  /**
   * Why the last typed range was refused, or `null` when the bounds are usable.
   * Contradictory input is reported in the form instead of being quietly
   * rewritten — see `applyPriceRange`.
   */
  protected priceRangeError = signal<'negative' | 'order' | 'invalid' | null>(null);
  /** The message that states why the last typed range was refused. */
  protected readonly priceErrorText = computed(() => {
    const key = this.priceRangeError();
    if (key === 'negative') return this.i18n.t('catalog.priceNegative');
    if (key === 'order') return this.i18n.t('catalog.priceOrder');
    if (key === 'invalid') return this.i18n.t('catalog.priceInvalid');
    return '';
  });

  // Draft filter state. Applied to the URL (debounced for search) so listings
  // stay bookmarkable and survive refresh/back-forward navigation.
  //
  // Price bounds live in the VISITOR'S SELECTED CURRENCY — exactly what the
  // two number fields and the chips show. The only conversion to the server's
  // USD contract happens in `currentQuery()`, so UI and applied state can never
  // disagree. `maxPrice: null` means "no upper bound".
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
  /**
   * A refinement (new filters or page) over results that are already on
   * screen. Those stay visible; only a load with nothing to show uses the
   * skeleton grid, so a filter change never blanks the page.
   */
  protected refreshing = computed(() => this.state() === 'loading' && this.items().length > 0);
  /** True after 3 s of an empty first load, so a slow backend is explained. */
  protected slow = signal(false);
  private slowTimer: ReturnType<typeof setTimeout> | null = null;
  // Active categories from the data source (drives the filter, never hardcoded).
  protected categories = signal<Category[]>([]);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private priceInputTimer: ReturnType<typeof setTimeout> | null = null;
  /** A destroyed page must never publish a URL or start a request. */
  private destroyed = false;
  private connectivity = inject(ConnectivityService);
  private readonly destroyRef = inject(DestroyRef);
  /**
   * The single request channel for the product list. Every load — the first
   * page, a filter change, a page change, an explicit Retry — goes through
   * here, so there is exactly ONE pipeline and therefore exactly one request
   * per applied query.
   */
  private readonly listQuery$ = new Subject<CatalogQuery>();
  /** One automatic refetch per outage; a second failure waits for the user. */
  private autoRetried = false;

  /** Currency of the price bounds before the latest currency switch. */
  private lastPriceCurrency: string | null = null;

  constructor() {
    // Price bounds are expressed in the filter currency; a currency switch
    // re-expresses them (and reloads) here and only here.
    effect(() => {
      const code = this.currency.code();
      // Track rate arrival too: the bounds are stored in the filter currency,
      // so the first usable snapshot has to re-express whatever is on screen.
      this.priceConversionAvailable();
      const pending = this.priceInputPending();
      untracked(() => this.onPriceCurrencyChanged(code, pending));
    });
    // Separate effect: the slow hint depends on the load state, not on prices.
    // Mixing both made every load transition re-run the price rebinding.
    // Only a load that has nothing to show can be "slow to the visitor":
    // while existing results stay on screen, the thin progress bar is enough.
    effect(() => {
      const busy = this.state() === 'loading' && this.items().length === 0;
      untracked(() => this.trackSlowHint(busy));
    });
    // A rail handle has to follow the applied range, so it is the third effect
    // of the constructor — `effect()` is only legal in an injection context.
    this.syncRailToDraft();
    this.connectivity.recovered$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.state() === 'error' && !this.autoRetried) {
          this.autoRetried = true;
          this.reload();
        }
      });

    // PrimeNG reads an arrow key as LTR geometry (ArrowLeft always lowers the
    // value). This rail runs right to left in Arabic, so that key would drag
    // the knob the wrong way — take the key before the handle does.
    fromEvent<KeyboardEvent>(document, 'keydown', { capture: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.mirrorRailArrow(event));

    // One loader for the whole listing. `switchMap` cancels the request that
    // is still in flight when a newer query arrives, so a slow answer for an
    // older filter can never overwrite the answer for the current one.
    this.listQuery$
      .pipe(
        switchMap((query) => {
          this.state.set('loading');
          return this.products.list(query).pipe(
            tap((res) => {
              this.items.set(res.items);
              this.total.set(res.total);
              this.autoRetried = false;
              // A page past the last one (stale bookmark, or filters that
              // shrank the result set) would render "no products" beside a
              // non-zero count. Land on the last real page instead; publishing
              // it re-runs this one loader, so there is still one request per
              // applied query.
              const lastPage = lastPageFor(res.total, this.pageSize());
              if (res.items.length === 0 && this.page() > lastPage) {
                this.state.set('loading');
                this.page.set(lastPage);
                this.pushUrl();
                return;
              }
              this.state.set('ok');
            }),
            // The failure is rendered by the page (retry / offline banner);
            // it must not escape as an unhandled error.
            catchError(() => {
              this.state.set('error');
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
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
    // The bounds live in the visitor's currency, so they must be re-expressed
    // whenever THAT currency changes — including a switch INTO USD, which the
    // old guard skipped and which silently changed the meaning of the bound.
    // Without a usable rate both sides are USD, so there is nothing to pivot.
    const previousFilter = previous === null ? 'USD' : this.filterCurrencyFor(previous);
    const nextFilter = this.filterCurrencyFor(code);
    if (previous !== null && previous !== code && previousFilter !== nextFilter) {
      this.draft.minPrice.set(this.pivotPrice(this.draft.minPrice(), previousFilter, nextFilter));
      this.draft.maxPrice.set(
        this.draft.maxPrice() === null ? null : this.pivotPrice(this.draft.maxPrice()!, previousFilter, nextFilter),
      );
      rebound = true;
    }
    // A refused edit deliberately is not in the draft, so the form keeps it:
    // the visitor is about to correct the number, not re-read the applied bounds.
    if (!pending && !this.priceRangeError()) {
      this.syncPriceField(this.minPriceInput, this.draft.minPrice(), 0);
      // An empty upper field is the visible form of "no upper bound".
      this.syncPriceField(this.maxPriceInput, this.draft.maxPrice());
    }
    if (rebound) this.refresh();
  }

  /**
   * Points a price field at an applied bound — unless its text already says
   * exactly that number. Both the draft and the URL speak normalized numbers,
   * and writing them back over the visitor's own spelling ("12,5", "0.") under
   * a live caret is what made a fraction impossible to type.
   */
  private syncPriceField(
    field: WritableSignal<number | string | null>,
    bound: number | null,
    emptyMeans: number | null = null,
  ): void {
    const raw = fieldText(field());
    if (raw !== '' && parseAmount(raw) === bound) return;
    // An empty box can already say exactly this: '' IS "no minimum" for the
    // lower field and "no maximum" for the upper one. Printing the bound in
    // anyway put a figure nobody typed into the form — the `0` that used to
    // sit in the minimum box on every first visit.
    if (raw === '' && bound === emptyMeans) return;
    field.set(bound ?? '');
  }

  /**
   * The currency the price bounds are expressed in for a given visitor
   * currency: that currency when a rate is available, otherwise USD (the
   * server's contract currency).
   */
  private filterCurrencyFor(code: string): string {
    return this.prices.convert(1, code, 'USD') != null ? code : 'USD';
  }

  /** Re-expresses a bound in another currency via the USD pivot. */
  private pivotPrice(amount: number, from: string, to: string): number {
    if (from === to) return amount;
    const usd = this.prices.convertPrecise(amount, from, 'USD');
    if (usd == null) return amount;
    const converted = this.prices.convertPrecise(usd, 'USD', to);
    if (converted == null) return amount;
    // Two decimals read as money, but a fraction bound must survive the pivot:
    // 0.23 EGP is 0.004 EUR, and rounding that to 00 would quietly drop the
    // filter the visitor just set. A bound that rounds away stays exact.
    const rounded = Math.round((converted + Number.EPSILON) * 100) / 100;
    return rounded > 0 || amount === 0 ? rounded : converted;
  }

  /**
   * The catalogue's price span, asked for once per session (the service
   * replays it). A failure leaves `catalogCeiling` null and the rail simply is
   * not drawn; nothing about filtering degrades, because the ceiling was never
   * a cap.
   */
  private loadPriceCeiling(): void {
    if (environment.useMockApi) return;
    this.products
      .priceRange()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((range) => {
        // (0, 0) is the API's answer for an empty catalogue — no scale to draw.
        if (range === null || range.maxPrice <= 0) return;
        this.catalogCeiling.set({ amount: range.maxPrice, currency: range.currency || 'USD' });
      });
  }

  /**
   * Keeps the handles on the applied range. While a bound is still being
   * entered the rail is left alone: re-positioning it from the last *applied*
   * values during a drag would snap the handle back under the pointer, and a
   * drag storm of requests is exactly why the fields debounce.
   */
  private syncRailToDraft(): void {
    effect(() => {
      const ceiling = this.priceRailMax();
      if (ceiling === null || this.priceInputPending()) return;
      const max = this.draft.maxPrice();
      this.priceRailValue.set([
        Math.min(this.draft.minPrice(), ceiling),
        max === null || max >= ceiling ? ceiling : max,
      ]);
    });
  }

  /**
   * A rail drag writes into the same two fields the visitor would have typed
   * into, so validation, the URL and the request stay one path instead of two
   * that can disagree. The last stop of the axis is the same state an emptied
   * maximum field means: no upper bound.
   */
  private writeRailBounds(event: { value?: number; values?: number[] }): void {
    const ceiling = this.priceRailMax();
    if (ceiling === null) return;
    const bounds = event.values ?? [];
    const min = snapRail(bounds.length > 0 ? bounds[0]! : 0);
    const max = snapRail(bounds.length > 1 ? bounds[1]! : min);
    // The announced value has to follow the pointer, not the last applied
    // range — writing back the same numbers the handle already shows.
    this.priceRailValue.set([min, max]);
    this.onPriceInput('min', min);
    this.onPriceInput('max', max >= ceiling ? null : max);
  }

  /**
   * One arrow step on a mirrored axis. Stopping the event is what keeps one
   * source of truth: the value moves through the writer a drag already uses, so
   * PrimeNG never also applies its left-to-right reading of the same key.
   */
  private mirrorRailArrow(event: KeyboardEvent): void {
    if (this.i18n.dir() !== 'rtl' || event.defaultPrevented) return;
    const handle =
      event.target instanceof HTMLElement ? event.target.closest('.p-slider-handle') : null;
    const delta = RTL_ARROW_STEP[event.code];
    const ceiling = this.priceRailMax();
    if (!handle || delta === undefined || ceiling === null) return;
    const rail = handle.closest('.p-slider');
    if (!rail || rail.classList.contains('p-disabled')) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = [...this.priceRailValue()];
    const index = handle.getAttribute('data-pc-section') === 'starthandler' ? 0 : 1;
    bounds[index] = snapRail(Math.min(ceiling, bounds[index]! + delta * this.priceRailStep()));
    this.writeRailBounds({ values: bounds });
  }

  protected onRailChange(event: SliderChangeEvent): void {
    this.writeRailBounds(event);
  }

  /** A released handle is a decision, not a keystroke: apply it now. */
  protected onRailSlideEnd(event: SliderSlideEndEvent): void {
    this.writeRailBounds(event);
    this.applyPriceRange();
  }

  /** Explicit Retry: reset the breaker, probe health, refetch immediately. */
  protected retry(): void {
    this.autoRetried = true;
    this.connectivity.retryNow();
    this.reload();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.clearSlowTimer();
    // A debounce that outlives the page would publish its URL from the
    // deactivated route, pulling the visitor back out of whatever they
    // navigated to (e.g. a product they clicked while typing).
    this.clearSearchTimer();
    this.clearPriceInputTimer();
  }

  private clearSearchTimer(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }

  private clearPriceInputTimer(): void {
    if (this.priceInputTimer) {
      clearTimeout(this.priceInputTimer);
      this.priceInputTimer = null;
    }
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

  /** Localized label for a non-"all" availability, shared by the chips. */
  private availabilityLabel = computed<Record<Availability, string>>(() => ({
    in_stock: this.i18n.t('catalog.inStock'),
    low_stock: this.i18n.t('catalog.lowStock'),
    out_of_stock: this.i18n.t('catalog.outOfStock'),
  }));

  protected activeChips = computed(() => {
    const chips: { key: string; label: string }[] = [];
    if (this.draft.q()) chips.push({ key: 'q', label: `“${this.draft.q()}”` });
    if (this.draft.category()) chips.push({ key: 'category', label: this.products.categoryName(this.draft.category()!) });
    if (this.draft.minPrice() > 0) chips.push({ key: 'min', label: `≥ ${this.currency.format(this.draft.minPrice(), this.filterCurrency())}` });
    if (this.draft.maxPrice() !== null) chips.push({ key: 'max', label: `≤ ${this.currency.format(this.draft.maxPrice()!, this.filterCurrency())}` });
    // The enum value is a contract token, never display text: show the same
    // localized label the availability select offers.
    const availability = this.draft.availability();
    if (availability !== 'all') chips.push({ key: 'avail', label: this.availabilityLabel()[availability] });
    if (this.draft.sale()) chips.push({ key: 'sale', label: this.i18n.t('catalog.onSaleOnly') });
    return chips;
  });

  ngOnInit(): void {
    // Filter categories come from the data source, independent of products.
    // A failed category request must not become an unhandled error and must
    // not block the product list: fall back to "All categories".
    this.products
      .categories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cats) => this.categories.set(cats),
        error: () => this.categories.set([]),
      });
    // The URL is the source of truth: every query-param change rebuilds the
    // draft and reloads, which keeps back/forward and bookmarks consistent.
    // First entry lands at the top (like every fresh page); later emissions
    // are in-page filter/pagination work, where the viewport must stay put.
    let firstEntry = true;
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.applyQueryParams(params);
        this.listQuery$.next(this.currentQuery());
        if (firstEntry) {
          firstEntry = false;
          this.scroll.scrollToTop();
        }
      });
    // The rail is a shortcut over the same two bounds: it asks the catalogue
    // for its price span once, and follows whatever range is applied.
    this.loadPriceCeiling();
  }

  /** Rebuilds the draft filter state from the URL. */
  private applyQueryParams(params: ParamMap): void {
    // The URL is untrusted input: the parser validates every value (unknown
    // sort/availability, a page below one, an oversized page size, bounds that
    // contradict each other) so no filter control or request can receive a
    // value it does not understand.
    const next = parseCatalogFilters(params, { pageSize: environment.pageSize });
    this.draft.q.set(next.q);
    this.draft.category.set(next.category);
    // Price params are numbers in the CURRENTLY SELECTED currency, matching
    // what the controls show. An absent `max` means "no upper bound".
    this.draft.minPrice.set(next.minPrice);
    this.draft.maxPrice.set(next.maxPrice);
    if (!this.priceInputPending()) {
      // Re-sync each field only when its text does not already MEAN the
      // incoming bound — see `syncPriceField`.
      this.syncPriceField(this.minPriceInput, next.minPrice, 0);
      this.syncPriceField(this.maxPriceInput, next.maxPrice);
      // The range came from the URL, which is coherent by construction, so any
      // earlier complaint about typed input no longer applies. An uncommitted
      // edit keeps its verdict on screen.
      this.priceRangeError.set(null);
    }
    this.draft.availability.set(next.availability);
    this.draft.sale.set(next.sale);
    this.draft.sort.set(next.sort);
    this.page.set(next.page);
    // The page size is part of the listing too, so a shared/bookmarked URL
    // shows the same number of products per page — clamped to what the server
    // accepts (`ListQuery.MaxPageSize`), so the pager and the server always
    // agree on the page size and the page count.
    this.pageSize.set(next.pageSize);
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
    // A converted fraction can land on 0.22433999999999998; the request says
    // 0.22434. Twelve significant digits are already far beyond the precision
    // of any exchange rate, so nothing meaningful is lost — only the noise.
    const asContract = (amount: number | null) =>
      amount === null ? undefined : Number(amount.toPrecision(12));
    return {
      search: this.draft.q() || undefined,
      categoryId: this.draft.category() || undefined,
      minPrice: asContract(minUsd),
      maxPrice: asContract(maxUsd),
      availability: this.draft.availability(),
      onSaleOnly: this.draft.sale() || undefined,
      sort: this.draft.sort(),
      page: this.page(),
      pageSize: this.pageSize(),
    };
  }

  private pushUrl(): void {
    // A page that is already gone must not publish a URL: navigation from a
    // deactivated route would drag the visitor back to the listing.
    if (this.destroyed) return;
    // Every known param is published (a `null` removes it), so clearing a
    // filter cannot leave its stale value in the URL.
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: catalogQueryParams(this.filterState(), { pageSize: environment.pageSize }),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** The applied filter state, in the shape the URL helpers speak. */
  private filterState(): CatalogFilterState {
    return {
      q: this.draft.q(),
      category: this.draft.category(),
      minPrice: this.draft.minPrice(),
      maxPrice: this.draft.maxPrice(),
      availability: this.draft.availability(),
      sale: this.draft.sale(),
      sort: this.draft.sort(),
      page: this.page(),
      pageSize: this.pageSize(),
    };
  }

  /**
   * Loads the list for the query that is currently applied. The request is
   * routed through the single loader, so it replaces any request that is still
   * in flight instead of racing it.
   */
  protected reload(): void {
    this.listQuery$.next(this.currentQuery());
  }

  /**
   * A filter changed. The URL is the single source of truth, so the change is
   * published there and the resulting query-param emission performs the load.
   * Reloading here as well would run the whole pipeline twice for one change.
   */
  private refresh(): void {
    // Any filter change restarts at page 1 — deeper pages may not exist anymore.
    this.page.set(1);
    this.pushUrl();
  }

  protected onSearchType(): void {
    // Debounce typing so each keystroke doesn't push a URL + request.
    this.clearSearchTimer();
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.refresh();
    }, 350);
  }

  protected setSort(v: SortKey): void {
    this.draft.sort.set(v);
    this.refresh();
  }

  protected setCategory(v: string): void {
    this.draft.category.set(v);
    this.refresh();
  }

  /**
   * The filter body is instantiated twice — the sidebar and the mobile drawer —
   * so an id used by a `<label for>` has to be unique per instance.
   */
  protected priceId(part: 'label' | 'min' | 'max' | 'hint' | 'msg', scope: string): string {
    return `catalog-price-${part}-${scope}`;
  }

  protected onPriceInput(bound: 'min' | 'max', value: number | string | null): void {
    if (bound === 'min') this.minPriceInput.set(value);
    else this.maxPriceInput.set(value);
    this.priceInputPending.set(true);
    this.clearPriceInputTimer();
    this.priceInputTimer = setTimeout(() => {
      this.priceInputTimer = null;
      this.applyPriceRange();
    }, 350);
  }

  protected applyPriceRange(): void {
    this.clearPriceInputTimer();

    // The fields hold the raw text while the visitor types, so an emptied one
    // reads as '' and must clear its bound rather than parse into something.
    const minRaw = fieldText(this.minPriceInput());
    const maxRaw = fieldText(this.maxPriceInput());
    if (!this.priceConversionAvailable()) {
      // No usable rate: refuse to apply a guessed meaning to the numbers.
      this.priceInputPending.set(false);
      return;
    }
    // An emptied lower field means 0; an emptied upper field means "no bound".
    const minDisplay = minRaw === '' ? 0 : parseAmount(minRaw);
    const maxDisplay: number | null = maxRaw === '' ? null : parseAmount(maxRaw);
    if (minDisplay === null || (maxRaw !== '' && maxDisplay === null)) {
      // Not an amount at all. Say so — silently keeping the old bounds reads as
      // a filter that ignores what was typed.
      this.priceRangeError.set('invalid');
      this.priceInputPending.set(false);
      return;
    }

    if (minDisplay < 0 || (maxDisplay !== null && maxDisplay < 0)) {
      // A negative price filters nothing, so it is a mistake rather than a
      // bound. Say so; do not floor it to 0 behind the visitor's back.
      this.priceRangeError.set('negative');
      this.priceInputPending.set(false);
      return;
    }
    // There is deliberately NO upper clamp here: the API filters on any
    // `maxPrice` it is given, a budget above the priciest product is a
    // legitimate question, and rewriting the number would make the form
    // disagree with the results on screen.
    const nextMin = minDisplay;
    const nextMax = maxDisplay;
    if (nextMax !== null && nextMax < nextMin) {
      // Reversed bounds match nothing. Keep the last applied range and explain,
      // instead of silently raising the maximum to meet the minimum.
      this.priceRangeError.set('order');
      this.priceInputPending.set(false);
      return;
    }
    this.priceRangeError.set(null);

    const changed = nextMin !== this.draft.minPrice() || nextMax !== this.draft.maxPrice();
    this.draft.minPrice.set(nextMin);
    this.draft.maxPrice.set(nextMax);
    // Echo only a field whose text does not already say what was applied, so a
    // value accepted exactly as typed is never re-written under the caret.
    this.syncPriceField(this.minPriceInput, nextMin, 0);
    this.syncPriceField(this.maxPriceInput, nextMax);
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
    if (ev.rows) this.pageSize.set(ev.rows);
    this.page.set((ev.page ?? 0) + 1);
    // The page change is published to the URL; the resulting query-param
    // emission performs the load (one request per applied query).
    this.pushUrl();
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
    this.clearPriceInputTimer();
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
