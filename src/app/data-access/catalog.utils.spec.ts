import { filterProducts, paginateProducts, queryProducts, sortProducts } from './catalog.utils';
import { MOCK_PRODUCTS } from './mock-data';

describe('catalog.utils', () => {
  it('filters by search term across name, description and tags', () => {
    const res = filterProducts(MOCK_PRODUCTS, { search: 'hibiscus' });
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((p) => `${p.name} ${p.description} ${p.tags.join(' ')}`.toLowerCase().includes('hibiscus'))).toBeTrue();
  });

  it('returns empty for a nonsense search term', () => {
    expect(filterProducts(MOCK_PRODUCTS, { search: 'zzz-no-such-product-zzz' }).length).toBe(0);
  });

  it('filters by category', () => {
    const res = filterProducts(MOCK_PRODUCTS, { categoryId: 'herbs' });
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((p) => p.categoryId === 'herbs')).toBeTrue();
  });

  it('filters by effective (sale) price range', () => {
    const res = filterProducts(MOCK_PRODUCTS, { minPrice: 10, maxPrice: 15 });
    expect(res.length).toBeGreaterThan(0);
    for (const p of res) {
      const eff = p.salePrice ?? p.price;
      expect(eff).toBeGreaterThanOrEqual(10);
      expect(eff).toBeLessThanOrEqual(15);
    }
  });

  it('filters on-sale-only products', () => {
    const res = filterProducts(MOCK_PRODUCTS, { onSaleOnly: true });
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((p) => p.salePrice != null)).toBeTrue();
  });

  it('filters by availability', () => {
    const out = filterProducts(MOCK_PRODUCTS, { availability: 'out_of_stock' });
    expect(out.every((p) => p.stock <= 0)).toBeTrue();
    const inStock = filterProducts(MOCK_PRODUCTS, { availability: 'in_stock' });
    expect(inStock.every((p) => p.stock > 5)).toBeTrue();
  });

  it('sorts price low→high and high→low', () => {
    const asc = sortProducts(MOCK_PRODUCTS, 'price_asc');
    const desc = sortProducts(MOCK_PRODUCTS, 'price_desc');
    const eff = (p: (typeof MOCK_PRODUCTS)[number]) => p.salePrice ?? p.price;
    for (let i = 1; i < asc.length; i++) expect(eff(asc[i])).toBeGreaterThanOrEqual(eff(asc[i - 1]));
    for (let i = 1; i < desc.length; i++) expect(eff(desc[i])).toBeLessThanOrEqual(eff(desc[i - 1]));
  });

  it('sorts newest first and bestselling by soldCount', () => {
    const newest = sortProducts(MOCK_PRODUCTS, 'newest');
    for (let i = 1; i < newest.length; i++) {
      expect(new Date(newest[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(newest[i].createdAt).getTime(),
      );
    }
    const best = sortProducts(MOCK_PRODUCTS, 'bestselling');
    for (let i = 1; i < best.length; i++) expect(best[i - 1].soldCount).toBeGreaterThanOrEqual(best[i].soldCount);
  });

  it('sorts names A→Z', () => {
    const sorted = sortProducts(MOCK_PRODUCTS, 'name_asc');
    const names = sorted.map((p) => p.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('paginates without overlap', () => {
    const p1 = paginateProducts(MOCK_PRODUCTS, 1, 10);
    const p2 = paginateProducts(MOCK_PRODUCTS, 2, 10);
    expect(p1.length).toBe(10);
    expect(p2.length).toBe(10);
    expect(p1.map((p) => p.id).some((id) => p2.map((p) => p.id).includes(id))).toBeFalse();
  });

  it('combines filter + sort + pagination consistently', () => {
    const q = { categoryId: 'cosmetics', sort: 'price_asc' as const, page: 1, pageSize: 3 };
    const r1 = queryProducts(MOCK_PRODUCTS, q);
    const r2 = queryProducts(MOCK_PRODUCTS, { ...q, page: 2 });
    expect(r1.total).toBeGreaterThan(0);
    expect(r1.items.length).toBeLessThanOrEqual(3);
    const ids1 = new Set(r1.items.map((p) => p.id));
    expect(r2.items.every((p) => !ids1.has(p.id))).toBeTrue();
  });
});
