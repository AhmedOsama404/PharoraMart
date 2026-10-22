import { SafeImageDirective } from '../../shared/resilience/safe-image.directive';
import { LocalizedPipe } from '../../shared/pipes/localized.pipe';
import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { toObservable, toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { map, distinctUntilChanged, switchMap, catchError, startWith, of, type Observable } from 'rxjs';
import { Breadcrumb } from 'primeng/breadcrumb';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { Tag } from 'primeng/tag';
import type { MenuItem } from 'primeng/api';
import { I18nService } from '../../core/services/i18n.service';
import { ProductService } from '../../core/services/product.service';
import { CartStore } from '../../core/services/cart.store';
import { FavoritesStore } from '../../core/services/favorites.store';
import { NotificationService } from '../../core/services/notification.service';
import { PendingActionService } from '../../core/services/pending-action.service';
import { RecentlyViewedService } from '../../core/services/recently-viewed.service';
import { ScrollService } from '../../core/services/scroll.service';
import { ConnectivityService } from '../../core/resilience/connectivity.service';
import { availabilityOf, discountPercent, effectivePrice, type Product } from '../../models/product.model';
import { ProductCardComponent } from '../../shared/components/product-card.component';
import { QtySelectorComponent } from '../../shared/components/qty-selector.component';
import { MAX_QTY_PER_LINE } from '../../core/services/cart.store';
import { SectionHeaderComponent } from '../../shared/components/section-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ResolvedMoneyPipe } from '../../shared/pipes/resolved-money.pipe';
import { handleImgError } from '../../shared/utils/image-fallback.utils';
import { pickLocaleText } from '../../shared/utils/localized.utils';
import type { ProductVariant } from '../../models/product.model';

// Stable RouterLinkActive options shared by every breadcrumb item below.
// PrimeNG Breadcrumb renders `[routerLinkActiveOptions]="item.options || { exact: false }"`:
// leaving the option unset allocates a fresh `{ exact: false }` object on EVERY
// change-detection cycle, which re-triggers RouterLinkActive.ngOnChanges
// → update() → queueMicrotask → a new change-detection tick, forever.
// That infinite loop used to freeze this page (permanent skeleton / dead tab).
// Frozen module-level references keep the binding referentially stable.
const CRUMB_MATCH_EXACT = { exact: true };
const CRUMB_MATCH_PREFIX = { exact: false };

// Explicit page state: every load ends in exactly one of these.
// No combination of booleans can drift into an inconsistent non-rendering state.
export type ProductDetailStatus = 'loading' | 'ready' | 'not-found' | 'error';

export interface ProductDetailState {
  status: ProductDetailStatus;
  product: Product | null;
  related: Product[];
}

const LOADING_STATE: ProductDetailState = { status: 'loading', product: null, related: [] };

@Component({
  selector: 'app-product-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SafeImageDirective, 
    RouterLink, FormsModule, Breadcrumb, Button, Select, Skeleton,
    Tabs, TabList, Tab, TabPanels, TabPanel, Tag,
    ProductCardComponent, QtySelectorComponent, SectionHeaderComponent, EmptyStateComponent, ResolvedMoneyPipe,
    LocalizedPipe,
  ],
  templateUrl: './product-detail-page.component.html',
  styleUrl: './product-detail-page.component.scss',
})
export class ProductDetailPageComponent implements OnDestroy {
  protected i18n = inject(I18nService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private products = inject(ProductService);
  private cart = inject(CartStore);
  private favorites = inject(FavoritesStore);
  private notify = inject(NotificationService);
  private gate = inject(PendingActionService);
  private recent = inject(RecentlyViewedService);
  private scroll = inject(ScrollService);
  private connectivity = inject(ConnectivityService);

  // Route id as an observable (for the cancellable loader) and as a signal
  // (for UI resets and memoized view data) so in-place navigation — e.g.
  // clicking a related product — reloads without a full page refresh.
  private productId$ = this.route.paramMap.pipe(
    map((params) => (params.get('id') ?? '').trim()),
    distinctUntilChanged(),
  );
  private productId = toSignal(this.productId$, { initialValue: '' });

  // Cancellation-aware page loader. The inner switchMap unsubscribes the
  // in-flight product/related requests as soon as the route id changes, so a
  // slow response can never overwrite the newly requested product (no stale
  // results on rapid navigation). Bumping reloadNonce re-runs the current id
  // (retry). toSignal unsubscribes everything on destroy — no manual teardown.
  private reloadNonce = signal(0);

  protected page = toSignal(
    toObservable(this.reloadNonce).pipe(
      switchMap(() => this.productId$.pipe(switchMap((id) => this.loadState(id)))),
    ),
    { initialValue: LOADING_STATE },
  );

  /** True after 3 s of loading so a hung backend gets a visible hint + Retry. */
  protected slow = signal(false);
  private slowTimer: ReturnType<typeof setTimeout> | null = null;
  private autoRetried = false;

  protected product = computed(() => this.page().product);

  // Per-product UI state, reset whenever a different product is requested so
  // the previous product's image index, quantity or variant picks never leak.
  protected activeImg = signal(0);
  protected qty = signal(1);

  /** The most units that can be chosen: the stock, never more than the cap. */
  protected maxQty(): number {
    const stock = this.product()?.stock ?? 0;
    return Math.max(1, Math.min(stock || 1, MAX_QTY_PER_LINE));
  }

  /** The most units of one product an order may hold. */
  protected readonly perItemCap = MAX_QTY_PER_LINE;

  /**
   * True when the limit the customer hit is the per-item cap (and not the
   * live stock) - the message has to say which one it is.
   */
  protected atPerItemCap(): boolean {
    const stock = this.product()?.stock ?? 0;
    return stock > MAX_QTY_PER_LINE && this.qty() >= MAX_QTY_PER_LINE;
  }
  protected selectedVariants: Record<string, string> = {};
  protected isFav = computed(() => {
    const p = this.product();
    return p ? this.favorites.ids().includes(p.id) : false;
  });

  // Breadcrumb model as a memoized computed: the SAME array (and the same
  // nested option objects) is handed to p-breadcrumb on every cycle until the
  // product or language actually changes (see the note above).
  protected crumbs = computed<MenuItem[]>(() => [
    { label: this.i18n.t('product.breadcrumbsHome'), routerLink: '/', routerLinkActiveOptions: CRUMB_MATCH_EXACT },
    { label: this.i18n.t('product.breadcrumbsCatalog'), routerLink: '/products', routerLinkActiveOptions: CRUMB_MATCH_PREFIX },
    { label: this.localizedName() },
  ]);

  /** The product name in the visitor's language (English fallback). */
  protected localizedName = computed(() => {
    const p = this.product();
    return p ? pickLocaleText(p.names, this.i18n.currentLang()) || p.name : '';
  });

  protected images = computed(() => this.product()?.images ?? []);
  protected effective = computed(() => (this.product() ? effectivePrice(this.product()!) : 0));
  protected discount = computed(() => (this.product() ? discountPercent(this.product()!) : 0));
  protected availability = computed(() =>
    this.product() ? availabilityOf(this.product()!) : 'out_of_stock',
  );
  protected categoryName = computed(() =>
    this.product() ? this.products.categoryName(this.product()!.categoryId) : '',
  );

  // Variant option lists cached per variant: handing p-select a fresh array on
  // every change-detection cycle forces it to resync continuously.
  private variantOptionCache = new Map<string, { label: string; value: string }[]>();

  constructor() {
    // Breadcrumb category label resolves from the live catalogue (dashboard
    // data), not the bundled demo set; the name is a computed, so it re-renders
    // as soon as the categories arrive.
    this.products.preloadCategories();
    // Reset per-product UI on navigation. The loader above already drops stale
    // DATA via unsubscription; the scroll reset below handles the reused
    // component instance: without it, selecting a related product keeps the
    // viewport at the bottom of the page (where the click happened) while the
    // new product renders. Instant, not smooth: the content is about to be
    // swapped for a skeleton, so an animation would only smear across layouts.
    effect(() => {
      this.productId();
      untracked(() => {
        this.scroll.scrollToTop();
        this.activeImg.set(0);
        this.qty.set(1);
        this.selectedVariants = {};
        this.variantOptionCache.clear();
      });
    });

    // Side effects that belong to a successful load only.
    effect(() => {
      const state = this.page();
      // The document title follows the visitor's language, like every other
      // title: the product name is the localized one, not the raw English.
      const lang = this.i18n.currentLang();
      if (state.status === 'ready' && state.product) {
        this.autoRetried = false;
        const product = state.product;
        untracked(() => {
          const name = pickLocaleText(product.names, lang) || product.name;
          document.title = `${name} — Pharora`;
          this.recent.push(product.id);
        });
      }
      this.trackSlowHint(state.status === 'loading');
    });

    this.connectivity.recovered$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (this.page().status === 'error' && !this.autoRetried) {
          this.autoRetried = true;
          this.retry();
        }
      });
  }

  ngOnDestroy(): void {
    this.clearSlowTimer();
  }

  private trackSlowHint(loading: boolean): void {
    if (!loading) {
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

  // Loads one terminal state for a product id. Never rejects and never hangs:
  // invalid ids resolve to not-found, request failures to error, and a
  // response without a usable product is treated as not-found.
  private loadState(id: string): Observable<ProductDetailState> {
    if (!id) {
      return of({ status: 'not-found', product: null, related: [] } as const);
    }
    return this.products.getById(id).pipe(
      map((product) => {
        if (!product || typeof product.id !== 'string') throw new Error('not-found');
        return product;
      }),
      switchMap((product) =>
        this.products.related(product).pipe(
          map((related): ProductDetailState => ({ status: 'ready', product, related })),
          // Related items are a nice-to-have: never fail the whole page for them.
          catchError((): Observable<ProductDetailState> => of({ status: 'ready', product, related: [] })),
        ),
      ),
      catchError((err: unknown): Observable<ProductDetailState> =>
        of({
          status: err instanceof Error && err.message === 'not-found' ? 'not-found' : 'error',
          product: null,
          related: [],
        }),
      ),
      startWith(LOADING_STATE),
    );
  }

  protected retry(): void {
    this.autoRetried = true;
    this.connectivity.retryNow();
    this.reloadNonce.update((n) => n + 1);
  }

  protected variantOptions(variant: ProductVariant): { label: string; value: string }[] {
    const locale = this.i18n.currentLang();
    const key = `${locale}:${variant.id}:${variant.options.join('|')}`;
    let cached = this.variantOptionCache.get(key);
    if (!cached) {
      cached = variant.options.map((value, index) => ({
        label: pickLocaleText(variant.optionTranslations?.[index] ?? undefined, locale) || value,
        value,
      }));
      this.variantOptionCache.set(key, cached);
    }
    return cached;
  }

  private variantSelection(): { key?: string; label?: string } {
    const p = this.product();
    if (!p?.variants?.length) return {};
    const selected = p.variants.map((variant) => {
      const value = this.selectedVariants[variant.id];
      if (!value) return null;
      const index = variant.options.indexOf(value);
      return pickLocaleText(variant.optionTranslations?.[index] ?? undefined, this.i18n.currentLang()) || value;
    }).filter((value): value is string => value !== null);
    const keys = p.variants.map((variant) => this.selectedVariants[variant.id]).filter((value): value is string => Boolean(value));
    if (!keys.length) return {};
    return { key: keys.join('|'), label: selected.join(' / ') };
  }

  protected addToCart(): void {
    const p = this.product();
    if (!p || p.stock <= 0) return;
    const { key, label } = this.variantSelection();
    // Guests sign in first; the exact qty + variant choice completes on return.
    if (!this.gate.requireAuth('addToCart', this.router.url, { kind: 'add-to-cart', productId: p.id, qty: this.qty(), variantKey: key, variantLabel: label })) return;
    const wanted = this.qty();
    const finalQty = this.cart.add(p.id, wanted, key, label, p.stock);
    if (finalQty < wanted) {
      // The shop has less than the customer asked for: say so instead of
      // pretending the whole quantity went in.
      this.notify.info('cart.qtyReduced', { from: wanted, to: finalQty });
      return;
    }

    this.notify.success('notifications.addedToCart');
  }

  protected toggleFav(): void {
    const p = this.product();
    if (!p) return;
    if (!this.gate.requireAuth('addToFavorites', this.router.url, { kind: 'add-to-favorite', productId: p.id })) return;
    const nowFav = this.favorites.toggle(p.id);
    this.notify.success(nowFav ? 'notifications.addedToFav' : 'notifications.removedFromFav');
  }

  protected quickAdd({ product: p, quantity }: { product: Product; quantity: number }): void {
    // Related-product shortcut: the guest returns here (product A) while the
    // action adds the related product B they actually clicked.
    if (!this.gate.requireAuth('addToCart', this.router.url, { kind: 'add-to-cart', productId: p.id, qty: quantity })) return;
    this.cart.add(p.id, quantity, undefined, undefined, p.stock);
    this.notify.success('notifications.addedToCart');
  }

  protected quickFav(p: Product): void {
    if (!this.gate.requireAuth('addToFavorites', this.router.url, { kind: 'add-to-favorite', productId: p.id })) return;
    const nowFav = this.favorites.toggle(p.id);
    this.notify.success(nowFav ? 'notifications.addedToFav' : 'notifications.removedFromFav');
  }

  protected goHome(): void {
    this.router.navigate(['/']);
  }

  protected fbImg(ev: Event, seed = 'novamart-detail'): void {
    // Shared two-stage recovery (picsum attempt, then framed placeholder).
    handleImgError(ev, seed);
  }
}
