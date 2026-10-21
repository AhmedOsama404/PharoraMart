import { SafeImageDirective } from '../../shared/resilience/safe-image.directive';
import { HttpErrorResponse } from '@angular/common/http';
import { LocalizedPipe } from '../../shared/pipes/localized.pipe';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, ViewChild, computed, effect, inject, signal, type WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { I18nService } from '../../core/services/i18n.service';
import { ProductService } from '../../core/services/product.service';
import { CartStore } from '../../core/services/cart.store';
import { FavoritesStore } from '../../core/services/favorites.store';
import { NotificationService } from '../../core/services/notification.service';
import { PendingActionService } from '../../core/services/pending-action.service';
import { RecentlyViewedService } from '../../core/services/recently-viewed.service';
import { ContentService, type ContentBlock } from '../../core/services/content.service';
import { StorefrontDefaultsService } from '../../core/services/storefront-defaults.service';
import { SiteContentService, type HomeSectionKey } from '../../core/services/site-content.service';
import { ConnectivityService } from '../../core/resilience/connectivity.service';
import {
  DataBoundaryComponent,
  type BoundaryState,
} from '../../shared/resilience/data-boundary.component';
import type { Category, Product } from '../../models/product.model';
import { ProductCardComponent } from '../../shared/components/product-card.component';
import { SectionHeaderComponent } from '../../shared/components/section-header.component';
import { ResolvedMoneyPipe } from '../../shared/pipes/resolved-money.pipe';
import { catchError, of, retry, throwError, timer, type Observable } from 'rxjs';

type HomeDataSection = 'categories' | 'featured' | 'newArrivals' | 'popular' | 'content';

@Component({
  selector: 'app-home-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SafeImageDirective, RouterLink, Button, Skeleton, ProductCardComponent, SectionHeaderComponent, ResolvedMoneyPipe, LocalizedPipe, DataBoundaryComponent,
  ],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent implements OnInit {
  @ViewChild('arrivalsTrack') private arrivalsTrack?: ElementRef<HTMLDivElement>;
  private arrivalsAutoTimer: number | null = null;
  // The hero badge icon stays a config-owned bare PrimeIcons name (hero product
  // slots come from Website Content, with the versioned config as a fallback).
  private static readonly BADGE_ICONS = new Set(['leaf', 'tag', 'shopping-bag', 'building', 'truck', 'money-bill', 'refresh', 'check-circle', 'heart']);
  protected i18n = inject(I18nService);
  private products = inject(ProductService);
  private cart = inject(CartStore);
  private favorites = inject(FavoritesStore);
  private notify = inject(NotificationService);
  private gate = inject(PendingActionService);
  private content = inject(ContentService);
  protected storefront = inject(StorefrontDefaultsService);
  protected siteContent = inject(SiteContentService);
  private recent = inject(RecentlyViewedService);
  private router = inject(Router);

  constructor() {
    let resolvedSlotKey = '';
    effect((onCleanup) => {
      if (!this.siteContent.ready()) return;
      const siteProductIds = this.siteContent.hero()?.productIds;
      // Website Content is the single source of truth for hero products.
      // Empty or unavailable CMS data must not resurrect stale product IDs
      // from the older versioned storefront configuration.
      if (!Array.isArray(siteProductIds)) {
        resolvedSlotKey = '';
        this.heroSlotMode.set(true);
        this.heroSlotProducts.set([null, null, null, null]);
        this.heroProductsLoading.set(false);
        return;
      }

      this.heroSlotMode.set(true);
      const ids = Array.from({ length: 4 }, (_, index) => {
        const id = siteProductIds[index];
        return typeof id === 'string' && id.trim() ? id.trim() : null;
      });
      const slotKey = JSON.stringify(ids);
      if (slotKey === resolvedSlotKey) return;
      resolvedSlotKey = slotKey;

      const selectedIds = ids.filter((id): id is string => id !== null);
      this.heroProductsLoading.set(true);
      const subscription = this.products.getByIds(selectedIds, { silent: true }).pipe(
        retry({
          count: 2,
          delay: (error, retryCount) => {
            const transient = error instanceof HttpErrorResponse &&
              (error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500);
            return transient ? timer(retryCount * 250) : throwError(() => error);
          },
        }),
        catchError(() => {
          // Allow a later content refresh (for example when the tab returns to
          // focus) to try this same selection again after a prolonged outage.
          resolvedSlotKey = '';
          return of([]);
        }),
      ).subscribe((items) => {
        // Keep the CMS slot order and empty slots exactly. Filling a failed or
        // intentionally empty slot from the featured feed made unrelated
        // products appear in the hero and hid CMS selection errors.
        const byId = new Map(items.map((product) => [product.id, product]));
        this.heroSlotProducts.set(ids.map((id) => id ? byId.get(id) ?? null : null));
        this.heroProductsLoading.set(false);
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  // Employee-editable hero copy (empty until loaded / when cleared).
  protected heroBadge = computed(() => this.siteContent.text(this.siteContent.hero()?.badge, this.i18n.currentLang()));
  protected heroHeadline = computed(() => this.siteContent.text(this.siteContent.hero()?.headline, this.i18n.currentLang()));
  protected heroDescription = computed(() => this.siteContent.text(this.siteContent.hero()?.description, this.i18n.currentLang()));
  protected heroPrimary = computed(() => this.siteContent.hero()?.primaryButton ?? null);
  protected heroSecondary = computed(() => this.siteContent.hero()?.secondaryButton ?? null);
  protected heroHighlights = computed(() => this.siteContent.hero()?.highlights ?? []);
  protected heroProductsLoading = signal(true);
  protected heroLoading = computed(() => !this.siteContent.ready() || this.heroProductsLoading());

  // One terminal state per home region. A failing feed can never leave another
  // region (or the whole page) stuck on a skeleton.
  protected state: Record<HomeDataSection, WritableSignal<BoundaryState>> = {
    categories: signal<BoundaryState>('loading'),
    featured: signal<BoundaryState>('loading'),
    newArrivals: signal<BoundaryState>('loading'),
    popular: signal<BoundaryState>('loading'),
    content: signal<BoundaryState>('loading'),
  };
  protected error: Record<HomeDataSection, WritableSignal<unknown>> = {
    categories: signal<unknown>(null),
    featured: signal<unknown>(null),
    newArrivals: signal<unknown>(null),
    popular: signal<unknown>(null),
    content: signal<unknown>(null),
  };
  private connectivity = inject(ConnectivityService);
  private destroyRef = inject(DestroyRef);

  protected categories = signal<Category[]>([]);
  protected featured = signal<Product[]>([]);
  protected newArrivals = signal<Product[]>([]);
  protected popular = signal<Product[]>([]);
  protected saleProduct = signal<Product | null>(null);
  protected recentlyViewed = signal<Product[]>([]);
  protected contentBlocks = signal<ContentBlock[]>([]);
  protected heroProduct = signal<Product | null>(null);
  protected heroTiles = signal<Product[]>([]);
  protected heroSlotMode = signal(false);
  protected heroSlotProducts = signal<(Product | null)[]>([null, null, null, null]);

  ngOnInit(): void {
    // Independent storefront sections load in parallel; each renders and fails
    // on its own. The old single `loading` flag left every section blank when
    // one feed failed.
    this.loadCategories();
    this.loadFeatured();
    this.loadNewArrivals();
    this.loadPopular();
    this.loadContent();
    this.loadRecentlyViewed();
    if (typeof window !== 'undefined') {
      this.scheduleArrivalsAdvance();
      this.destroyRef.onDestroy(() => {
        if (this.arrivalsAutoTimer !== null) window.clearTimeout(this.arrivalsAutoTimer);
      });
    }

    // Reconnect/focus recovery: refetch only the regions that failed.
    this.connectivity.recovered$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.failed('categories')) this.loadCategories();
        if (this.failed('featured')) this.loadFeatured();
        if (this.failed('newArrivals')) this.loadNewArrivals();
        if (this.failed('popular')) this.loadPopular();
        if (this.failed('content')) this.loadContent();
        if (this.failedRecentlyViewed) this.loadRecentlyViewed();
      });
  }

  protected loadCategories(): void {
    this.setSection('categories', 'loading');
    this.products.categories().subscribe({
      next: (items) => {
        const settings = this.storefront.sectionSettings('categories');
        const selected = settings?.categoryIds;
        const list = selected
          ? selected
              .map((id) => items.find((item) => item.id === id))
              .filter((item): item is Category => !!item)
          : items.slice(0, settings?.maxItems ?? items.length);
        this.categories.set(list);
        this.setSection('categories', list.length ? 'success' : 'empty');
      },
      error: (err: unknown) => this.setSection('categories', this.failureState(), err),
    });
  }

  protected loadFeatured(): void {
    this.setSection('featured', 'loading');
    this.products.featured().subscribe({
      next: (items) => {
        const settings = this.storefront.sectionSettings('featured');
        if (settings?.selectionMode === 'manual' && settings.productIds) {
          this.resolveProducts(
            settings.productIds.slice(0, settings.maxItems ?? 8),
            (selected) => {
              const list = selected.slice(0, settings.maxItems ?? 8);
              this.featured.set(list);
              this.setSection('featured', list.length ? 'success' : 'empty');
            },
            (err) => this.setSection('featured', this.failureState(), err),
          );
        } else {
          const list = items.slice(0, settings?.maxItems ?? 8);
          this.featured.set(list);
          this.setSection('featured', list.length ? 'success' : 'empty');
        }
        this.loadPromo(items);
      },
      error: (err: unknown) => this.setSection('featured', this.failureState(), err),
    });
  }

  protected loadNewArrivals(): void {
    this.loadGrid('newArrivals', this.products.newArrivals(), (items) => this.newArrivals.set(items));
  }

  protected loadPopular(): void {
    this.loadGrid('popular', this.products.popular(), (items) => this.popular.set(items));
  }

  protected loadContent(): void {
    this.setSection('content', 'loading');
    this.content.published().subscribe({
      next: (blocks) => {
        this.contentBlocks.set(blocks);
        this.setSection('content', 'success');
      },
      error: (err: unknown) => this.setSection('content', 'error', err),
    });
  }

  private loadRecentlyViewed(): void {
    this.failedRecentlyViewed = false;
    const ids = this.recent.list();
    if (!ids.length) {
      this.recentlyViewed.set([]);
      return;
    }
    this.products.getByIdsMany(ids).subscribe({
      next: (items) => {
        const byId = new Map(items.map((p) => [p.id, p]));
        this.recentlyViewed.set(
          ids.map((id) => byId.get(id)).filter((p): p is Product => !!p).slice(0, 4),
        );
      },
      // Recently viewed is personal, optional content: hide it rather than
      // failing the page, and retry after the next reconnect.
      error: () => {
        this.recentlyViewed.set([]);
        this.failedRecentlyViewed = true;
      },
    });
  }

  private failedRecentlyViewed = false;

  private loadGrid(
    key: 'newArrivals' | 'popular',
    request$: Observable<Product[]>,
    set: (items: Product[]) => void,
  ): void {
    this.setSection(key, 'loading');
    request$.subscribe({
      next: (items) => {
        const settings = this.storefront.sectionSettings(key);
        if (settings?.selectionMode === 'manual' && settings.productIds) {
          this.resolveProducts(
            settings.productIds.slice(0, settings.maxItems ?? 8),
            (selected) => {
              const list = selected.slice(0, settings.maxItems ?? 8);
              set(list);
              this.setSection(key, list.length ? 'success' : 'empty');
            },
            (err) => this.setSection(key, this.failureState(), err),
          );
          return;
        }
        const list = items.slice(0, settings?.maxItems ?? 8);
        set(list);
        this.setSection(key, list.length ? 'success' : 'empty');
      },
      error: (err: unknown) => this.setSection(key, this.failureState(), err),
    });
  }

  private loadPromo(items: Product[]): void {
    const settings = this.storefront.sectionSettings('promo');
    if (settings?.productId) {
      this.products
        .getById(settings.productId)
        .pipe(catchError(() => of(null)))
        .subscribe((product) => this.saleProduct.set(product));
      return;
    }
    this.saleProduct.set(items.find((p) => p.salePrice != null) ?? items[0] ?? null);
  }

  private resolveProducts(
    ids: readonly string[],
    next: (products: Product[]) => void,
    onError?: (err: unknown) => void,
  ): void {
    if (ids.length === 0) {
      next([]);
      return;
    }
    this.products.getByIdsMany(ids).subscribe({
      next,
      error: (err: unknown) => (onError ? onError(err) : next([])),
    });
  }

  private failed(key: HomeDataSection): boolean {
    const state = this.state[key]();
    return state === 'error' || state === 'offline';
  }

  private failureState(): BoundaryState {
    return this.connectivity.status() === 'offline' ? 'offline' : 'error';
  }

  private setSection(key: HomeDataSection, state: BoundaryState, error: unknown = null): void {
    this.state[key].set(state);
    this.error[key].set(error);
  }

  protected addToCart({ product: p, quantity }: { product: Product; quantity: number }): void {
    if (p.stock <= 0) return;
    // Account-required action: guests are routed through sign-in first and
    // the add completes automatically on return (see PendingActionService).
    if (!this.gate.requireAuth('addToCart', this.router.url, { kind: 'add-to-cart', productId: p.id, qty: quantity })) return;
    this.cart.add(p.id, quantity, undefined, undefined, p.stock);
    this.notify.success('notifications.addedToCart');
  }

  protected toggleFav(p: Product): void {
    if (!this.gate.requireAuth('addToFavorites', this.router.url, { kind: 'add-to-favorite', productId: p.id })) return;
    const nowFav = this.favorites.toggle(p.id);
    this.notify.success(nowFav ? 'notifications.addedToFav' : 'notifications.removedFromFav');
  }

  protected go(path: string): void {
    this.router.navigate([path]);
  }

  protected scrollArrivals(direction: -1 | 1, manual = true): void {
    const track = this.arrivalsTrack?.nativeElement;
    if (!track) return;
    if (manual) this.scheduleArrivalsAdvance();
    const rtl = this.i18n.dir() === 'rtl';
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const firstCard = track.firstElementChild as HTMLElement | null;
    const lastCard = track.lastElementChild as HTMLElement | null;
    if (!firstCard || !lastCard || track.scrollWidth <= track.clientWidth + 1) return;
    const trackBounds = track.getBoundingClientRect();
    const firstBounds = firstCard.getBoundingClientRect();
    const lastBounds = lastCard.getBoundingClientRect();
    const atStart = rtl ? firstBounds.right <= trackBounds.right + 1 : firstBounds.left >= trackBounds.left - 1;
    const atEnd = rtl ? lastBounds.left >= trackBounds.left - 1 : lastBounds.right <= trackBounds.right + 1;
    if ((direction === 1 && atEnd) || (direction === -1 && atStart)) {
      (direction === 1 ? firstCard : lastCard).scrollIntoView({
        behavior: reducedMotion ? 'instant' : 'smooth',
        block: 'nearest',
        inline: 'start',
      });
      return;
    }

    const card = track.querySelector<HTMLElement>('.car-item');
    const gap = Number.parseFloat(window.getComputedStyle(track).columnGap) || 0;
    track.scrollBy({
      left: direction * (rtl ? -1 : 1) * ((card?.getBoundingClientRect().width ?? track.clientWidth) + gap),
      behavior: reducedMotion ? 'instant' : 'smooth',
    });
  }

  private advanceArrivals(): void {
    const track = this.arrivalsTrack?.nativeElement;
    if (!track || this.newArrivals().length < 2 || document.visibilityState !== 'visible' ||
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.scheduleArrivalsAdvance();
      return;
    }
    const trackBounds = track.getBoundingClientRect();
    if (trackBounds.bottom <= 0 || trackBounds.top >= window.innerHeight || track.scrollWidth <= track.clientWidth + 1) {
      this.scheduleArrivalsAdvance();
      return;
    }

    this.scrollArrivals(1, false);
    this.scheduleArrivalsAdvance();
  }

  private scheduleArrivalsAdvance(): void {
    if (typeof window === 'undefined') return;
    if (this.arrivalsAutoTimer !== null) window.clearTimeout(this.arrivalsAutoTimer);
    this.arrivalsAutoTimer = window.setTimeout(() => {
      this.arrivalsAutoTimer = null;
      this.advanceArrivals();
    }, 3_000);
  }

  protected pauseArrivalsOnHover(): void {
    if (this.arrivalsAutoTimer !== null) {
      window.clearTimeout(this.arrivalsAutoTimer);
      this.arrivalsAutoTimer = null;
    }
  }

  protected resumeArrivalsAfterHover(): void {
    this.scheduleArrivalsAdvance();
  }

  protected goSale(): void {
    this.router.navigate(['/products'], { queryParams: { sale: 1 } });
  }

  protected goTo(url: string): void {
    if (url.startsWith('/') && !url.startsWith('//')) {
      this.router.navigateByUrl(url);
      return;
    }
    window.location.assign(url);
  }

  protected badgeIcon(): string {
    const configured = this.storefront.sectionSettings('hero')?.heroIcons?.badge;
    return configured && HomePageComponent.BADGE_ICONS.has(configured) ? `pi pi-${configured}` : 'pi pi-leaf';
  }

  // Employee-editable home-section copy; visibility defaults to on when absent.
  protected sectionTitle(key: HomeSectionKey): string {
    return this.siteContent.text(this.siteContent.homeSection(key)?.title, this.i18n.currentLang());
  }

  protected sectionBody(key: HomeSectionKey): string {
    return this.siteContent.text(this.siteContent.homeSection(key)?.body, this.i18n.currentLang());
  }

  protected sectionViewAll(key: HomeSectionKey): string {
    return this.siteContent.text(this.siteContent.homeSection(key)?.viewAllText, this.i18n.currentLang());
  }

  protected sectionViewAllUrl(key: HomeSectionKey): string {
    return this.siteContent.safeUrl(this.siteContent.homeSection(key)?.viewAllUrl);
  }

  protected sectionVisible(key: HomeSectionKey): boolean {
    return this.siteContent.homeSectionVisible(key);
  }
  // Dashboard-managed names/descriptions in the visitor's language.
  protected blockTitle(b: ContentBlock): string {
    return b.titles?.[this.i18n.currentLang()] ?? b.title;
  }

  protected blockBody(b: ContentBlock): string {
    return b.bodies?.[this.i18n.currentLang()] ?? b.body;
  }
  protected categoryName(c: Category): string {
    // Use the live category object directly so the card reflects dashboard
    // name edits without waiting on a separate id lookup.
    return this.products.categoryLabel(c);
  }

  protected categoryDescription(c: Category): string {
    return this.products.categoryDescription(c);
  }
}
