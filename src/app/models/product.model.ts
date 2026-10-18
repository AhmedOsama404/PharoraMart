export type Availability = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface ProductAttribute {
  name: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  options: string[];
}

export interface Product {
  id: string;
  sku: string;
  /** English display name (convenience mirror of names.en when present). */
  name: string;
  description: string;
  /** Dashboard-managed localized names; the storefront renders these when set. */
  names?: LocalizedText;
  /** Dashboard-managed localized descriptions. */
  descriptions?: LocalizedText;
  categoryId: string;
  price: number;
  salePrice?: number;
  currency?: string;
  images: string[];
  rating: number;
  reviewsCount: number;
  soldCount: number;
  stock: number;
  isNew: boolean;
  isFeatured: boolean;
  isPopular: boolean;
  tags: string[];
  attributes: ProductAttribute[];
  variants?: ProductVariant[];
  createdAt: string;
}

export interface Category {
  /** Stable identifier (slug-like). Display names are never used as ids. */
  id: string;
  /** English display name (convenience mirror of names.en). */
  name: string;
  /** Dashboard-managed localized display names; missing languages fall back to English. */
  names: LocalizedText;
  /** English description; localized variants where the dashboard provides them. */
  description: string;
  descriptions?: LocalizedText;
  image: string;
  /** Dashboard-controlled ordering on the storefront. */
  sortOrder: number;
  /** Inactive categories are hidden from navigation/filters; their products
   * and existing orders keep rendering gracefully (see ProductService). */
  isActive: boolean;
  productCount?: number;
}

// Localized display text for dashboard-managed content (category names,
// hotel names, …). English is the required fallback; other languages are
// optional so partially translated catalogs still render.
export interface LocalizedText {
  en: string;
  ar?: string;
  cs?: string;
  it?: string;
  pl?: string;
  fr?: string;
  sk?: string;
  de?: string;
}

export type SortKey =
  | 'recommended'
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'name_asc'
  | 'bestselling';

export interface CatalogQuery {
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: Availability | 'all';
  inStockOnly?: boolean;
  onSaleOnly?: boolean;
  tags?: string[];
  sort?: SortKey;
  page?: number;
  pageSize?: number;
}

export function effectivePrice(p: Product): number {
  return p.salePrice ?? p.price;
}

export function discountPercent(p: Product): number {
  if (p.salePrice == null || p.price <= 0 || p.salePrice >= p.price) return 0;
  return Math.round((1 - p.salePrice / p.price) * 100);
}

export function availabilityOf(p: Product): Availability {
  if (p.stock <= 0) return 'out_of_stock';
  if (p.stock <= 5) return 'low_stock';
  return 'in_stock';
}
