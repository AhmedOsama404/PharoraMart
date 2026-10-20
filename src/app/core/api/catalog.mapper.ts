import type { CatalogQuery, Category, Product, ProductAttribute, ProductVariant } from '../../models/product.model';
import { resolveMediaUrl } from '../../shared/utils/media-url.utils';

/**
 * Single typed boundary between the ASP.NET Core DTOs (docs/API_CONTRACT.md)
 * and the storefront models. Backend JSON is camelCase and field-for-field
 * compatible, so this normalizes nullability (variants/salePrice/images/tags)
 * and translates the query object to backend query params. Kept pure and free
 * of Angular/HTTP so it is unit-testable with plain inputs.
 */

export interface BackendLocalizedText {
  en: string;
  ar?: string;
  cs?: string;
  it?: string;
  pl?: string;
  fr?: string;
  sk?: string;
  de?: string;
}

export interface BackendProduct {
  id: string;
  sku: string;
  name: string;
  description: string;
  categoryId: string;
  price: number;
  salePrice?: number | null;
  currency?: string;
  images: string[] | null;
  rating: number;
  reviewsCount: number;
  soldCount: number;
  stock: number;
  isNew: boolean;
  isFeatured: boolean;
  isPopular: boolean;
  tags: string[] | null;
  attributes: ProductAttribute[] | null;
  variants?: ProductVariant[] | null;
  names?: BackendLocalizedText | null;
  descriptions?: BackendLocalizedText | null;
  createdAt: string;
}

export interface BackendCategory {
  id: string;
  name: string;
  names: BackendLocalizedText;
  description: string;
  descriptions?: BackendLocalizedText | null;
  image: string;
  sortOrder: number;
  isActive: boolean;
  productCount?: number | null;
}

export interface BackendPaged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BackendSuggest {
  id: string;
  name: string;
  image: string;
}

/** Null-tolerant array so malformed/partial payloads never crash the UI. */
function arr<T>(v: T[] | null | undefined): T[] {
  return Array.isArray(v) ? v : [];
}

export function toProduct(p: BackendProduct): Product {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    description: p.description ?? '',
    categoryId: p.categoryId,
    price: p.price,
    salePrice: p.salePrice ?? undefined,
    currency: p.currency ?? undefined,
    images: arr(p.images).map(resolveMediaUrl),
    rating: p.rating,
    reviewsCount: p.reviewsCount,
    soldCount: p.soldCount,
    stock: p.stock,
    isNew: p.isNew,
    isFeatured: p.isFeatured,
    isPopular: p.isPopular,
    tags: arr(p.tags),
    attributes: arr(p.attributes).map((attribute) => ({ ...attribute })),
    variants: p.variants ? p.variants.map((variant) => ({ ...variant, optionTranslations: variant.optionTranslations ?? undefined })) : undefined,
    names: p.names ?? undefined,
    descriptions: p.descriptions ?? undefined,
    createdAt: p.createdAt,
  };
}

export function toCategory(c: BackendCategory): Category {
  return {
    id: c.id,
    name: c.name,
    names: c.names,
    description: c.description ?? '',
    descriptions: c.descriptions ?? undefined,
    image: resolveMediaUrl(c.image),
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    productCount: c.productCount ?? undefined,
  };
}

/** Header suggestions (id, name, image) → minimal Product with one image. */
export function suggestToProduct(s: BackendSuggest): Product {
  return {
    id: s.id,
    sku: '',
    name: s.name,
    description: '',
    categoryId: '',
    price: 0,
    currency: undefined,
    images: s.image ? [resolveMediaUrl(s.image)] : [],
    rating: 0,
    reviewsCount: 0,
    soldCount: 0,
    stock: 0,
    isNew: false,
    isFeatured: false,
    isPopular: false,
    tags: [],
    attributes: [],
    createdAt: '',
  };
}

/**
 * Frontend CatalogQuery → backend query params. Differences vs mock:
 * `search→q`, `onSaleOnly→onSale`, availability passes through (minus 'all'),
 * tags as a repeated array. `inStockOnly` has no server param (the catalog UI
 * drives `availability`), so it maps to no server filter — intentionally
 * documented rather than guessed.
 */
export function toProductQueryParams(q: CatalogQuery): Record<string, string | number | boolean | string[] | undefined> {
  const params: Record<string, string | number | boolean | string[] | undefined> = {};
  if (q.search) params['q'] = q.search;
  if (q.categoryId) params['categoryId'] = q.categoryId;
  if (q.minPrice != null) params['minPrice'] = q.minPrice;
  if (q.maxPrice != null) params['maxPrice'] = q.maxPrice;
  if (q.availability && q.availability !== 'all') params['availability'] = q.availability;
  if (q.onSaleOnly) params['onSale'] = true;
  if (q.tags && q.tags.length) params['tags'] = q.tags;
  if (q.sort) params['sort'] = q.sort;
  if (q.page != null) params['page'] = q.page;
  if (q.pageSize != null) params['pageSize'] = q.pageSize;
  return params;
}
