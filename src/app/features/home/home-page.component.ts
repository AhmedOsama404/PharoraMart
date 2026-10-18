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
import { StorefrontConfigService } from '../../core/services/storefront-config.service';
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
  protected storefront = inject(StorefrontConfigService);
  protected siteContent = inject(SiteContentService);
  private recent = inject(RecentlyViewedService);
  private router = inject(Router);

  constructor() {
    let resolvedSlotKey = '';
    effect((onCleanup) => {
      if (!this.siteContent.ready()) return;
      const heroSettings = this.storefront.sectionSettings('hero');
      const siteProductIds = this.siteContent.hero()?.productIds;
      // Website Content is the active CMS editor for hero products. Prefer its
      // catalog IDs when populated; keep the versioned config as a compatibility
      // fallback for stores that have not selected products in Website Content.
      const hasSiteProductSelection = Array.isArray(siteProductIds) && siteProductIds.some(
        (id) => typeof id === 'string' && id.trim().length > 0,
      );
      const productSlots = hasSiteProductSelection ? siteProductIds : heroSettings?.heroProductSlots;
      if (!Array.isArray(productSlots)) {
        resolvedSlotKey = '';
        this.heroSlotMode.set(false);
        this.heroSlotProducts.set([null, null, null, null]);
        return;
      }

      this.heroSlotMode.set(true);
      const ids = Array.from({ length: 4 }, (_, index) => {
        const id = productSlots[index];
        return typeof id === 'string' && id.trim() ? id.trim() : null;
      });
      const slotKey = JSON.stringify(ids);
      if (slotKey === resolvedSlotKey) return;
      resolvedSlotKey = slotKey;

      const subscription = forkJoin([
        ...ids.map((id) => {
          if (!id) return of(null);
          return this.products.getById(id, { silent: true }).pipe(
            retry({
              count: 2,
              delay: (error, retryCount) => {
                const transient = error instanceof HttpErrorResponse &&
                  (error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500);
                return transient ? timer(retryCount * 250) : throwError(() => error);
              },
            }),
            catchError(() => of(null)),
          );
        }),
      ]).subscribe((items) => {
        // Keep the CMS slot order and empty slots exactly. Filling a failed or
        // intentionally empty slot from the featured feed made unrelated
        // products appear in the hero and hid CMS selection errors.
        this.heroSlotProducts.set(items as (Product | null)[]);
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
      const heroSettings = this.storefront.sectionSettings('hero');
      const siteProductIds = this.siteContent.hero()?.productIds;
      const hasSiteProductSelection = Array.isArray(siteProductIds) && siteProductIds.some(
        (id) => typeof id === 'string' && id.trim().length > 0,
      );
      // Resolve the old product fields only when neither CMS slot source is set.
      if (!hasSiteProductSelection && !Array.isArray(heroSettings?.heroProductSlots)) {
        if (heroSettings?.mainProductId) {
          this.products.getById(heroSettings.mainProductId).pipe(catchError(() => of(null))).subscribe((product) => {
            this.heroProduct.set(product);
          });
        } else {
          this.heroProduct.set(items[0] ?? null);
        }
        if (heroSettings?.supportingProductIds) {
          this.resolveProducts(heroSettings.supportingProductIds, (selected) => this.heroTiles.set(selected.slice(0, 6)));
        } else {
          this.heroTiles.set(items.slice(1, 4));
        }
      }
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

  protected addToCart(p: Product): void {
    if (p.stock <= 0) return;
    // Account-required action: guests are routed through sign-in first and
    // the add completes automatically on return (see PendingActionService).
    if (!this.gate.requireAuth('addToCart', this.router.url, { kind: 'add-to-cart', productId: p.id, qty: 1 })) return;
    this.cart.add(p.id, 1, undefined, undefined, p.stock);
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
