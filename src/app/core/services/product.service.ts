import { Injectable, signal } from '@angular/core';
import { Observable, catchError, delay, forkJoin, of, throwError, map, shareReplay, tap } from 'rxjs';
import { MOCK_CATEGORIES, MOCK_PRODUCTS } from '../../data-access/mock-data';
import { queryProducts } from '../../data-access/catalog.utils';
import type { CatalogQuery, Category, Product } from '../../models/product.model';
import { pickLocaleText } from '../../shared/utils/localized.utils';
import { environment } from '../../../environments/environment';
import { I18nService } from './i18n.service';
import { ApiClientService } from '../api/api-client.service';
import { toProduct, toCategory, suggestToProduct, toProductQueryParams, BackendPaged, BackendProduct, BackendCategory, BackendSuggest } from '../api/catalog.mapper';

/**
 * ProductService — single data-access boundary for products.
 * Mock mode serves local data with simulated latency; real mode delegates
 * to ApiClientService (see docs/API_CONTRACT.md). Components never call HTTP.
 */
@Injectable({ providedIn: 'root' })
export class ProductService {
  private products = signal<Product[]>(MOCK_PRODUCTS);
  private categoriesStore = signal<Category[]>(MOCK_CATEGORIES);
  /**
   * Active categories fetched from the live API, retained so synchronous
   * lookups (category cards, breadcrumbs, catalog filters) resolve the
   * dashboard-managed names/descriptions/images instead of falling back to the
   * bundled demo catalogue — dashboard category edits must surface here.
   */
  private liveCategories = signal<Category[]>([]);
  /** Guards preloadCategories() so a page load issues at most one request. */
  private categoriesLoaded = false;
  /** The one live taxonomy request of this session (see categories()). */
  private categoriesRequest$: Observable<Category[]> | null = null;
  /** When true, catalog requests fail — used to demo the error state. */
  forceError = signal(false);

  constructor(
    private i18n: I18nService,
    private api: ApiClientService,
  ) {}

  list(query: CatalogQuery = {}): Observable<{ items: Product[]; total: number }> {
    if (this.forceError()) {
      return throwError(() => new Error('mock-catalog-failure')).pipe(delay(400));
    }
    if (!environment.useMockApi) {
      const params = toProductQueryParams(query);
      return this.api.get<BackendPaged<BackendProduct>>('products', params).pipe(
        map((res) => ({
          items: res.items.map(toProduct),
          total: res.total,
        })),
      );
    }
    return of(queryProducts(this.products(), query)).pipe(delay(350));
  }

  /**
   * Full catalog snapshot for pages that join local state (cart lines,
   * favorites, checkout review) against product data. Mock mode resolves
   * synchronously from the in-memory set; live mode fetches a bounded
   * snapshot (first 100 active products) so these pages keep working.
   */
  all(): Observable<Product[]> {
    if (!environment.useMockApi) {
      return this.list({ page: 1, pageSize: 100 }).pipe(map((r) => r.items));
    }
    return of(this.products());
  }

  getById(id: string, optionsIn?: { readonly silent?: boolean }): Observable<Product> {
    if (!environment.useMockApi) {
      return this.api.get<BackendProduct>(`products/${encodeURIComponent(id)}`, undefined, optionsIn).pipe(map(toProduct));
    }
    const found = this.products().find((p) => p.id === id);
    if (!found) return throwError(() => new Error('not-found')).pipe(delay(250));
    return of(found).pipe(delay(250));
  }

  getByIds(ids: readonly string[], optionsIn?: { readonly silent?: boolean }): Observable<Product[]> {
    const orderedIds = ids.filter((id, index) => !!id && ids.indexOf(id) === index);
    if (!orderedIds.length) return of([]);
    if (this.forceError()) {
      return throwError(() => new Error('mock-catalog-failure')).pipe(delay(400));
    }
    if (!environment.useMockApi) {
      return this.api.get<BackendProduct[]>('products/by-ids', { ids: orderedIds }, optionsIn).pipe(
        map((items) => items.map(toProduct)),
      );
    }
    const byId = new Map(this.products().map((product) => [product.id, product]));
    return of(orderedIds.map((id) => byId.get(id)).filter((product): product is Product => !!product));
  }

  /** Resolve larger local joins (such as a cart) without downloading the full catalog. */
  getByIdsMany(ids: readonly string[]): Observable<Product[]> {
    const orderedIds = ids.filter((id, index) => !!id && ids.indexOf(id) === index);
    if (!orderedIds.length) return of([]);
    if (environment.useMockApi) {
      if (this.forceError()) return throwError(() => new Error('mock-catalog-failure')).pipe(delay(400));
      const wanted = new Set(orderedIds);
      return of(this.products().filter((product) => wanted.has(product.id)));
    }

    const batches: string[][] = [];
    for (let index = 0; index < orderedIds.length; index += 100) {
      batches.push(orderedIds.slice(index, index + 100));
    }
    return forkJoin(batches.map((batch) =>
      this.api.post<BackendProduct[]>('products/by-ids', { ids: batch }).pipe(map((items) => items.map(toProduct))),
    )).pipe(map((groups) => {
      const byId = new Map(groups.flat().map((product) => [product.id, product]));
      return orderedIds.map((id) => byId.get(id)).filter((product): product is Product => !!product);
    }));
  }

  /**
   * Active categories in dashboard order. Inactive or removed categories never
   * reach navigation or filters; products pointing at them still render with
   * a graceful id fallback (see categoryName). The live response is cached so
   * synchronous lookups resolve dashboard data (see categoryById).
   */
  categories(): Observable<Category[]> {
    if (!environment.useMockApi) {
      // The taxonomy is fetched at most once per session: the home page, the
      // catalog filter and the product breadcrumb all need it, and it only
      // changes when the dashboard publishes a new one.
      if (!this.categoriesRequest$) {
        let request$!: Observable<Category[]>;
        request$ = this.api.get<BackendCategory[]>('categories').pipe(
          map((items) => items.map(toCategory)),
          tap((items) => {
            this.liveCategories.set(items);
            this.categoriesLoaded = true;
          }),
          // A failed load must not be remembered: the next caller may retry.
          catchError((err: unknown) => {
            if (this.categoriesRequest$ === request$) {
              this.categoriesRequest$ = null;
              this.categoriesLoaded = false;
            }
            return throwError(() => err);
          }),
          // `refCount: false` keeps the answer for the whole session, so the
          // three callers share ONE request instead of one each.
          shareReplay({ bufferSize: 1, refCount: false }),
        );
        this.categoriesRequest$ = request$;
      }
      return this.categoriesRequest$;
    }
    const active = this.categoriesStore()
      .filter((c) => c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return of(active).pipe(delay(200));
  }

  /**
   * Loads the active categories once per session so pages that only render a
   * category name (e.g. the product-detail breadcrumb) resolve it from the
   * dashboard data. Idempotent; a failed load leaves the flag clear so the next
   * caller may retry.
   */
  preloadCategories(): void {
    if (this.categoriesLoaded || environment.useMockApi) return;
    this.categories().subscribe({ error: () => (this.categoriesLoaded = false) });
  }

  /**
   * The live set once it has loaded (even when empty), else the bundled demo
   * set — so mock mode and a not-yet-loaded live catalogue both keep resolving
   * names, and a real (possibly empty) catalogue never resurrects demo names.
   */
  private categorySource(): Category[] {
    const live = this.liveCategories();
    return this.categoriesLoaded ? live : this.categoriesStore();
  }

  categoryById(id: string): Category | undefined {
    return this.categorySource().find((c) => c.id === id);
  }

  /** Localized label for a category the caller already holds. */
  categoryLabel(category: Category): string {
    return pickLocaleText(category.names, this.i18n.currentLang()) || category.name;
  }

  /** Localized display name for the active language, English fallback. */
  categoryName(id: string): string {
    const found = this.categoryById(id);
    if (!found) return id;
    return this.categoryLabel(found);
  }

  /** Localized description for category cards. */
  categoryDescription(c: Category): string {
    return pickLocaleText(c.descriptions, this.i18n.currentLang()) || c.description;
  }

  related(product: Product, limit = 4): Observable<Product[]> {
    if (!environment.useMockApi) {
      return this.api.get<BackendProduct[]>(`products/${product.id}/related`, { limit }).pipe(
        map((items) => items.map(toProduct)),
      );
    }
    const pool = this.products().filter(
      (p) => p.id !== product.id && (p.categoryId === product.categoryId || p.tags.some((t) => product.tags.includes(t))),
    );
    const fallback = this.products().filter((p) => p.id !== product.id && !pool.includes(p));
    return of([...pool, ...fallback].slice(0, limit)).pipe(delay(200));
  }

  featured(): Observable<Product[]> {
    if (!environment.useMockApi) {
      return this.api.get<BackendProduct[]>('products/featured').pipe(
        map((items) => items.map(toProduct)),
      );
    }
    return of(this.products().filter((p) => p.isFeatured).slice(0, 8)).pipe(delay(250));
  }

  newArrivals(): Observable<Product[]> {
    if (!environment.useMockApi) {
      return this.api.get<BackendProduct[]>('products/new').pipe(
        map((items) => items.map(toProduct)),
      );
    }
    return of(
      [...this.products()].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 8),
    ).pipe(delay(250));
  }

  popular(): Observable<Product[]> {
    if (!environment.useMockApi) {
      return this.api.get<BackendProduct[]>('products/popular').pipe(
        map((items) => items.map(toProduct)),
      );
    }
    return of(this.products().filter((p) => p.isPopular).slice(0, 8)).pipe(delay(250));
  }

  onSale(): Observable<Product[]> {
    if (!environment.useMockApi) {
      return this.api.get<BackendProduct[]>('products/sale').pipe(
        map((items) => items.map(toProduct)),
      );
    }
    return of(this.products().filter((p) => p.salePrice != null).slice(0, 8)).pipe(delay(250));
  }

  suggestions(term: string, limit = 6): Observable<Product[]> {
    const s = term.trim().toLowerCase();
    if (!s) return of([]);
    if (!environment.useMockApi) {
      return this.api.get<BackendSuggest[]>('products/suggest', { q: term, limit }).pipe(
        map((items) => items.map(suggestToProduct)),
      );
    }
    return of(
      this.products()
        .filter((p) => `${p.name} ${p.tags.join(' ')}`.toLowerCase().includes(s))
        .slice(0, limit),
    );
  }
}
