import {
  MAX_PAGE_SIZE,
  catalogQueryParams,
  lastPageFor,
  parseCatalogFilters,
  type CatalogFilterState,
} from './catalog-query.utils';

/** Builds the minimal ParamMap-shaped reader the parser accepts. */
function params(query: Record<string, string | null>): { get(name: string): string | null } {
  return { get: (name: string) => query[name] ?? null };
}

const DEFAULTS = { pageSize: 12 };

describe('catalog-query.utils', () => {
  describe('parseCatalogFilters', () => {
    it('defaults an empty URL to the unfiltered first page', () => {
      const state = parseCatalogFilters(params({}), DEFAULTS);
      expect(state).toEqual({
        q: '',
        category: '',
        minPrice: 0,
        maxPrice: null,
        availability: 'all',
        sale: false,
        sort: 'recommended',
        page: 1,
        pageSize: 12,
      });
    });

    it('replaces an unknown sort instead of binding a select that has no such option', () => {
      expect(parseCatalogFilters(params({ sort: 'bogus' }), DEFAULTS).sort).toBe('recommended');
      expect(parseCatalogFilters(params({ sort: 'price_asc' }), DEFAULTS).sort).toBe('price_asc');
    });

    it('replaces an unknown availability with "all"', () => {
      expect(parseCatalogFilters(params({ avail: 'bogus' }), DEFAULTS).availability).toBe('all');
      expect(parseCatalogFilters(params({ avail: 'low_stock' }), DEFAULTS).availability).toBe('low_stock');
    });

    it('never sends a page below one', () => {
      expect(parseCatalogFilters(params({ page: '-3' }), DEFAULTS).page).toBe(1);
      expect(parseCatalogFilters(params({ page: 'abc' }), DEFAULTS).page).toBe(1);
      expect(parseCatalogFilters(params({ page: '2' }), DEFAULTS).page).toBe(2);
    });

    it('clamps the page size to what the API accepts', () => {
      expect(parseCatalogFilters(params({ size: '999' }), DEFAULTS).pageSize).toBe(MAX_PAGE_SIZE);
      expect(parseCatalogFilters(params({ size: '0' }), DEFAULTS).pageSize).toBe(12);
      expect(parseCatalogFilters(params({ size: '24' }), DEFAULTS).pageSize).toBe(24);
    });

    it('treats an absent or unusable upper bound as unbounded', () => {
      expect(parseCatalogFilters(params({}), DEFAULTS).maxPrice).toBeNull();
      expect(parseCatalogFilters(params({ max: '' }), DEFAULTS).maxPrice).toBeNull();
      expect(parseCatalogFilters(params({ max: 'nope' }), DEFAULTS).maxPrice).toBeNull();
      expect(parseCatalogFilters(params({ max: '200' }), DEFAULTS).maxPrice).toBe(200);
    });

    it('keeps the price bounds coherent when a URL contradicts itself', () => {
      const state = parseCatalogFilters(params({ min: '50', max: '10' }), DEFAULTS);
      expect(state.minPrice).toBe(50);
      expect(state.maxPrice).toBe(50);
    });

    it('ignores a negative lower bound', () => {
      expect(parseCatalogFilters(params({ min: '-40' }), DEFAULTS).minPrice).toBe(0);
    });

    it('trims the search term', () => {
      expect(parseCatalogFilters(params({ q: '  aloe  ' }), DEFAULTS).q).toBe('aloe');
    });
  });

  describe('catalogQueryParams', () => {
    const state: CatalogFilterState = {
      q: '',
      category: '',
      minPrice: 0,
      maxPrice: null,
      availability: 'all',
      sale: false,
      sort: 'recommended',
      page: 1,
      pageSize: 12,
    };

    it('clears every filter key when the state is default (merge-safe)', () => {
      expect(catalogQueryParams(state, DEFAULTS)).toEqual({
        q: null,
        category: null,
        min: null,
        max: null,
        priceMode: null,
        avail: null,
        sale: null,
        sort: null,
        page: null,
        size: null,
      });
    });

    it('emits only the values that differ from the defaults', () => {
      const params = catalogQueryParams(
        { ...state, q: 'aloe', maxPrice: 200, availability: 'low_stock', sale: true, sort: 'newest', page: 2, pageSize: 24 },
        DEFAULTS,
      );
      expect(params).toEqual({
        q: 'aloe',
        category: null,
        min: null,
        max: 200,
        priceMode: null,
        avail: 'low_stock',
        sale: 1,
        sort: 'newest',
        page: 2,
        size: 24,
      });
    });

    it('round-trips through the parser', () => {
      const written = catalogQueryParams({ ...state, q: 'aloe', minPrice: 10, page: 3 }, DEFAULTS);
      const read = parseCatalogFilters(
        params(Object.fromEntries(Object.entries(written).map(([k, v]) => [k, v === null ? null : String(v)]))),
        DEFAULTS,
      );
      expect(read.q).toBe('aloe');
      expect(read.minPrice).toBe(10);
      expect(read.page).toBe(3);
    });
  });

  describe('lastPageFor', () => {
    it('computes the page that holds the last item', () => {
      expect(lastPageFor(14, 12)).toBe(2);
      expect(lastPageFor(12, 12)).toBe(1);
      expect(lastPageFor(0, 12)).toBe(1);
      expect(lastPageFor(Number.NaN, 12)).toBe(1);
    });
  });
});
