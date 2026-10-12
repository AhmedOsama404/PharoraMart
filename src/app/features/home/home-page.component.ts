import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
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
import { handleImgError } from '../../shared/utils/image-fallback.utils';
import type { Category, Product } from '../../models/product.model';
import { ProductCardComponent } from '../../shared/components/product-card.component';
import { SectionHeaderComponent } from '../../shared/components/section-header.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

@Component({
  selector: 'app-home-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Button, Carousel, Skeleton, Tag, ProductCardComponent, SectionHeaderComponent, MoneyPipe],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent implements OnInit {
  protected i18n = inject(I18nService);
  private products = inject(ProductService);
  private cart = inject(CartStore);
  private favorites = inject(FavoritesStore);
  private notify = inject(NotificationService);
  private gate = inject(PendingActionService);
  private recent = inject(RecentlyViewedService);
  private router = inject(Router);

  protected loading = signal(true);
  protected categories = signal<Category[]>([]);
  protected featured = signal<Product[]>([]);
  protected newArrivals = signal<Product[]>([]);
  protected popular = signal<Product[]>([]);
  protected saleProduct = signal<Product | null>(null);
  protected recentlyViewed = signal<Product[]>([]);
  protected heroProduct = signal<Product | null>(null);
  protected heroTiles = signal<Product[]>([]);

  protected carouselOpts = [
    { breakpoint: '1024px', numVisible: 3, numScroll: 2 },
    { breakpoint: '768px', numVisible: 2, numScroll: 1 },
    { breakpoint: '560px', numVisible: 1, numScroll: 1 },
  ];

  ngOnInit(): void {
    // Independent storefront sections load in parallel; each renders as it arrives.
    this.products.categories().subscribe((c) => this.categories.set(c));
    this.products.featured().subscribe((items) => {
      this.featured.set(items);
      this.heroProduct.set(items[0] ?? null);
      this.heroTiles.set(items.slice(1, 4));
      this.saleProduct.set(items.find((p) => p.salePrice != null) ?? items[0] ?? null);
      this.loading.set(false);
    });
    this.products.newArrivals().subscribe((items) => this.newArrivals.set(items));
    this.products.popular().subscribe((items) => this.popular.set(items));
    // Recently viewed ids are local-only; resolve them against the catalog.
    const ids = this.recent.list();
    if (ids.length) {
      this.products.all().subscribe((items) => {
        const byId = new Map(items.map((p) => [p.id, p]));
        this.recentlyViewed.set(ids.map((id) => byId.get(id)).filter((p): p is Product => !!p).slice(0, 4));
      });
    }
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

  // Dashboard-managed names/descriptions in the visitor's language.
  protected categoryName(c: Category): string {
    return this.products.categoryName(c.id);
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
