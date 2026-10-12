import { Injectable, signal } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { MOCK_CATEGORIES, MOCK_PRODUCTS } from '../../data-access/mock-data';
import { queryProducts } from '../../data-access/catalog.utils';
import type { CatalogQuery, Category, Product } from '../../models/product.model';
import { pickLocaleText } from '../../shared/utils/localized.utils';
import { environment } from '../../../environments/environment';
import { I18nService } from './i18n.service';

/**
 * ProductService — single data-access boundary for products.
 * Mock mode serves local data with simulated latency; real mode would delegate
 * to ApiClientService (see docs/API_CONTRACT.md). Components never call HTTP.
 */
@Injectable({ providedIn: 'root' })
export class ProductService {
  private products = signal<Product[]>(MOCK_PRODUCTS);
  private categoriesStore = signal<Category[]>(MOCK_CATEGORIES);
  /** When true, catalog requests fail — used to demo the error state. */
  forceError = signal(false);

  constructor(private i18n: I18nService) {}

  list(query: CatalogQuery = {}): Observable<{ items: Product[]; total: number }> {
    if (this.forceError()) {
      return throwError(() => new Error('mock-catalog-failure')).pipe(delay(400));
    }
    if (!environment.useMockApi) {
      return throwError(() => new Error('real-api-not-configured')).pipe(delay(200));
    }
    return of(queryProducts(this.products(), query)).pipe(delay(350));
  }

  /**
   * Full catalog snapshot for pages that join local state (cart lines,
   * favorites, checkout review) against product data. Resolves synchronously
   * from the in-memory mock set — no artificial latency, so these pages paint
   * immediately. A real API would resolve line items server-side instead.
   */
  all(): Observable<Product[]> {
    if (!environment.useMockApi) {
      return throwError(() => new Error('real-api-not-configured'));
    }
    return of(this.products());
  }

  getById(id: string): Observable<Product> {
    const found = this.products().find((p) => p.id === id);
    if (!found) return throwError(() => new Error('not-found')).pipe(delay(250));
    return of(found).pipe(delay(250));
  }

  /**
   * Active categories in dashboard order. Inactive or removed categories never
   * reach navigation or filters; products pointing at them still render with
   * a graceful id fallback (see categoryName).
   */
  categories(): Observable<Category[]> {
    if (!environment.useMockApi) {
      return throwError(() => new Error('real-api-not-configured')).pipe(delay(200));
    }
    const active = this.categoriesStore()
      .filter((c) => c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return of(active).pipe(delay(200));
  }

  categoryById(id: string): Category | undefined {
    return this.categoriesStore().find((c) => c.id === id);
  }

  /** Localized display name for the active language, English fallback. */
  categoryName(id: string): string {
    const found = this.categoryById(id);
    if (!found) return id;
    return pickLocaleText(found.names, this.i18n.currentLang()) || found.name;
  }

  /** Localized description for category cards. */
  categoryDescription(c: Category): string {
    return pickLocaleText(c.descriptions, this.i18n.currentLang()) || c.description;
  }

  related(product: Product, limit = 4): Observable<Product[]> {
    const pool = this.products().filter(
      (p) => p.id !== product.id && (p.categoryId === product.categoryId || p.tags.some((t) => product.tags.includes(t))),
    );
    const fallback = this.products().filter((p) => p.id !== product.id && !pool.includes(p));
    return of([...pool, ...fallback].slice(0, limit)).pipe(delay(200));
  }

  featured(): Observable<Product[]> {
    return of(this.products().filter((p) => p.isFeatured).slice(0, 8)).pipe(delay(250));
  }

  newArrivals(): Observable<Product[]> {
    return of(
      [...this.products()].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 8),
    ).pipe(delay(250));
  }

  popular(): Observable<Product[]> {
    return of(this.products().filter((p) => p.isPopular).slice(0, 8)).pipe(delay(250));
  }

  onSale(): Observable<Product[]> {
    return of(this.products().filter((p) => p.salePrice != null).slice(0, 8)).pipe(delay(250));
  }

  suggestions(term: string, limit = 6): Observable<Product[]> {
    const s = term.trim().toLowerCase();
    if (!s) return of([]);
    return of(
      this.products()
        .filter((p) => `${p.name} ${p.tags.join(' ')}`.toLowerCase().includes(s))
        .slice(0, limit),
    );
  }
}
