import { HttpErrorResponse } from '@angular/common/http';
import { LocalizedPipe } from '../../shared/pipes/localized.pipe';
import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Carousel } from 'primeng/carousel';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
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
import { handleImgError } from '../../shared/utils/image-fallback.utils';
import type { Category, Product } from '../../models/product.model';
import { ProductCardComponent } from '../../shared/components/product-card.component';
import { SectionHeaderComponent } from '../../shared/components/section-header.component';
import { ResolvedMoneyPipe } from '../../shared/pipes/resolved-money.pipe';
import { catchError, forkJoin, of, retry, throwError, timer } from 'rxjs';

@Component({
  selector: 'app-home-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Button, Carousel, Skeleton, Tag, ProductCardComponent, SectionHeaderComponent, ResolvedMoneyPipe, LocalizedPipe,
  ],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent implements OnInit {
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

  protected loading = signal(true);
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

  protected carouselOpts = [
    { breakpoint: '1024px', numVisible: 3, numScroll: 2 },
    { breakpoint: '768px', numVisible: 2, numScroll: 1 },
    { breakpoint: '560px', numVisible: 1, numScroll: 1 },
  ];

  ngOnInit(): void {
    // Independent storefront sections load in parallel; each renders as it arrives.
    const categorySettings = this.storefront.sectionSettings('categories');
    this.products.categories().subscribe((items) => {
      const selected = categorySettings?.categoryIds;
      this.categories.set(selected ? selected.map((id) => items.find((item) => item.id === id)).filter((item): item is Category => !!item)
        : items.slice(0, categorySettings?.maxItems ?? items.length));
    });
    this.products.featured().subscribe((items) => {
      const featuredSettings = this.storefront.sectionSettings('featured');
      if (featuredSettings?.selectionMode === 'manual' && featuredSettings.productIds) {
        this.resolveProducts(featuredSettings.productIds, (selected) => this.featured.set(selected.slice(0, featuredSettings.maxItems ?? 8)));
      } else {
        this.featured.set(items.slice(0, featuredSettings?.maxItems ?? 8));
      }

      if (!this.siteContent.ready()) return;
      const promoSettings = this.storefront.sectionSettings('promo');
      if (promoSettings?.productId) {
        this.products.getById(promoSettings.productId).pipe(catchError(() => of(null))).subscribe((product) => this.saleProduct.set(product));
      } else {
        this.saleProduct.set(items.find((p) => p.salePrice != null) ?? items[0] ?? null);
      }
      this.loading.set(false);
    });
    this.products.newArrivals().subscribe((items) => this.applyProductSection('newArrivals', items, (selected) => this.newArrivals.set(selected)));
    this.products.popular().subscribe((items) => this.applyProductSection('popular', items, (selected) => this.popular.set(selected)));
    this.content.published().subscribe((blocks) => this.contentBlocks.set(blocks));
    // Recently viewed ids are local-only; resolve them against the catalog.
    const ids = this.recent.list();
    if (ids.length) {
      this.products.all().subscribe((items) => {
        const byId = new Map(items.map((p) => [p.id, p]));
        this.recentlyViewed.set(ids.map((id) => byId.get(id)).filter((p): p is Product => !!p).slice(0, 4));
      });
    }
  }

  private applyProductSection(type: 'newArrivals' | 'popular', automatic: Product[], set: (items: Product[]) => void): void {
    const settings = this.storefront.sectionSettings(type);
    if (settings?.selectionMode === 'manual' && settings.productIds) {
      this.resolveProducts(settings.productIds, (items) => set(items.slice(0, settings.maxItems ?? 8)));
      return;
    }
    set(automatic.slice(0, settings?.maxItems ?? 8));
  }

  private resolveProducts(ids: readonly string[], next: (products: Product[]) => void): void {
    if (ids.length === 0) {
      next([]);
      return;
    }
    forkJoin(ids.map((id) => this.products.getById(id).pipe(catchError(() => of(null)))))
      .subscribe((items) => next(items.filter((item): item is Product => !!item)));
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

  protected fbImg(ev: Event): void {
    // Shared recovery with once-guard (the old version re-set the source on
    // every error event) plus framed-placeholder fallback.
    handleImgError(ev, 'novamart');
  }
}
