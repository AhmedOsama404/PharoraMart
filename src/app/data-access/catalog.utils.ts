import {
  availabilityOf,
  effectivePrice,
  type CatalogQuery,
  type Product,
} from '../models/product.model';

/** Pure, testable catalog logic shared by services and specs. */

export function filterProducts(products: Product[], q: CatalogQuery): Product[] {
  const search = (q.search ?? '').trim().toLowerCase();
  return products.filter((p) => {
    if (q.categoryId && p.categoryId !== q.categoryId) return false;
    if (search) {
      const hay = `${p.name} ${p.description} ${p.tags.join(' ')}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    const price = effectivePrice(p);
    if (q.minPrice != null && price < q.minPrice) return false;
    if (q.maxPrice != null && price > q.maxPrice) return false;
    if (q.onSaleOnly && p.salePrice == null) return false;
    if (q.inStockOnly && p.stock <= 0) return false;
    if (q.availability && q.availability !== 'all' && availabilityOf(p) !== q.availability) return false;
    if (q.tags?.length && !q.tags.every((t) => p.tags.includes(t))) return false;
    return true;
  });
}

export function sortProducts(products: Product[], sort: CatalogQuery['sort']): Product[] {
  const arr = [...products];
  switch (sort) {
    case 'price_asc':
      return arr.sort((a, b) => effectivePrice(a) - effectivePrice(b));
    case 'price_desc':
      return arr.sort((a, b) => effectivePrice(b) - effectivePrice(a));
    case 'name_asc':
      return arr.sort((a, b) => a.name.localeCompare(b.name));
    case 'newest':
      return arr.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    case 'bestselling':
      return arr.sort((a, b) => b.soldCount - a.soldCount);
    case 'recommended':
    default:
      return arr.sort(
        (a, b) =>
          Number(b.isFeatured) - Number(a.isFeatured) ||
          b.rating - a.rating ||
          b.soldCount - a.soldCount,
      );
  }
}

export function paginateProducts<T>(items: T[], page: number, pageSize: number): T[] {
  const p = Math.max(1, page || 1);
  const size = Math.max(1, pageSize || 12);
  return items.slice((p - 1) * size, p * size);
}

export function queryProducts(
  products: Product[],
  q: CatalogQuery,
): { items: Product[]; total: number } {
  const filtered = sortProducts(filterProducts(products, q), q.sort ?? 'recommended');
  const total = filtered.length;
  const items =
    q.page != null && q.pageSize != null
      ? paginateProducts(filtered, q.page, q.pageSize)
      : filtered;
  return { items, total };
}
