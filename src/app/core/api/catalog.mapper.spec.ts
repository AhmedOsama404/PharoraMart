import {
  toProduct,
  toCategory,
  suggestToProduct,
  toProductQueryParams,
} from './catalog.mapper';
import type { BackendCategory, BackendProduct } from './catalog.mapper';

// These verify the single typed boundary between the ASP.NET Core DTOs and the
// storefront models — the correctness half of the real-API integration — without
// needing a running backend.

const baseProduct: BackendProduct = {
  id: 'argan-oil',
  sku: 'COS-1001',
  name: 'Cold-Pressed Argan Oil 100ml',
  description: 'desc',
  categoryId: 'cosmetics',
  price: 24,
  salePrice: 19,
  currency: 'USD',
  images: ['a.jpg', 'b.jpg'],
  rating: 4.8,
  reviewsCount: 1830,
  soldCount: 14200,
  stock: 46,
  isNew: false,
  isFeatured: true,
  isPopular: true,
  tags: ['skincare', 'bestseller'],
  attributes: [{ name: 'Volume', value: '100 ml' }],
  variants: [{ id: 'size', name: 'Size', options: ['50 ml', '100 ml'] }],
  createdAt: '2026-06-02T10:00:00Z',
};

describe('catalog.mapper', () => {
  it('maps every product field 1:1', () => {
    const p = toProduct(baseProduct);
    expect(p.id).toBe('argan-oil');
    expect(p.salePrice).toBe(19);
    expect(p.images).toEqual(['a.jpg', 'b.jpg']);
    expect(p.variants?.[0].options).toEqual(['50 ml', '100 ml']);
    expect(p.attributes).toEqual([{ name: 'Volume', value: '100 ml' }]);
  });

  it('normalizes nullish collections and drops null variants/salePrice', () => {
    const p = toProduct({
      ...baseProduct,
      salePrice: null,
      images: null,
      tags: null,
      attributes: null,
      variants: null,
    });
    expect(p.salePrice).toBeUndefined();
    expect(p.variants).toBeUndefined();
    expect(p.images).toEqual([]);
    expect(p.tags).toEqual([]);
    expect(p.attributes).toEqual([]);
  });

  it('maps category with localized names and omits null descriptions', () => {
    const c = toCategory({
      id: 'cosmetics',
      name: 'Cosmetics',
      names: { en: 'Cosmetics', ar: 'ar-name' },
      description: 'd',
      descriptions: null,
      image: 'i.jpg',
      sortOrder: 1,
      isActive: true,
      productCount: 3,
    } as BackendCategory);
    expect(c.names.ar).toBe('ar-name');
    expect(c.productCount).toBe(3);
    expect(c.descriptions).toBeUndefined();
  });

  it('wraps a header suggestion as a minimal Product with one image', () => {
    const p = suggestToProduct({ id: 'x', name: 'X', image: 'x.jpg' });
    expect(p.images).toEqual(['x.jpg']);
    expect(p.name).toBe('X');
    expect(suggestToProduct({ id: 'y', name: 'Y', image: '' }).images).toEqual([]);
  });

  it('renames search→q and onSaleOnly→onSale, passes availability minus all', () => {
    expect(toProductQueryParams({ search: 'abc', onSaleOnly: true, availability: 'in_stock' })).toEqual({
      q: 'abc',
      availability: 'in_stock',
      onSale: true,
    });
  });

  it('omits availability=all, and passes tags/price/sort/paging', () => {
    expect(toProductQueryParams({
      availability: 'all',
      categoryId: 'herbs',
      minPrice: 5,
      maxPrice: 50,
      tags: ['a', 'b'],
      sort: 'price_asc',
      page: 2,
      pageSize: 24,
    })).toEqual({
      categoryId: 'herbs',
      minPrice: 5,
      maxPrice: 50,
      tags: ['a', 'b'],
      sort: 'price_asc',
      page: 2,
      pageSize: 24,
    });
  });

  it('returns empty params for an empty query', () => {
    expect(toProductQueryParams({})).toEqual({});
  });
});
