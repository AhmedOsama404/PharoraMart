import type { Availability, SortKey } from '../../models/product.model';

/**
 * The catalogue's URL state. A shared or bookmarked `/products` link is
 * untrusted input: every param is validated here, or replaced by its default,
 * before it can reach a filter control or the API.
 *
 * Kept pure and Angular-free so the parsing rules are unit-testable, and so
 * the page has one place that decides what a URL means.
 */

/** Mirrors `ListQuery.MaxPageSize` / `CatalogService.MaxPageSize` on the API. */
export const MAX_PAGE_SIZE = 100;

/** The sort keys the API accepts (a closed list on the server: unknown = 422). */
export const CATALOG_SORT_KEYS: readonly SortKey[] = [
  'recommended',
  'newest',
  'price_asc',
  'price_desc',
  'name_asc',
  'bestselling',
];

const AVAILABILITIES: readonly Availability[] = ['in_stock', 'low_stock', 'out_of_stock'];

/** Query-param reader (structurally satisfied by Angular's `ParamMap`). */
export interface CatalogParams {
  get(name: string): string | null;
}

export interface CatalogFilterState {
  readonly q: string;
  readonly category: string;
  /** Bound in the visitor's filter currency (see the catalog page). */
  readonly minPrice: number;
  /** `null` means "no upper bound". */
  readonly maxPrice: number | null;
  readonly availability: 'all' | Availability;
  readonly sale: boolean;
  readonly sort: SortKey;
  readonly page: number;
  readonly pageSize: number;
}

export function isSortKey(value: string | null | undefined): value is SortKey {
  return value != null && (CATALOG_SORT_KEYS as readonly string[]).includes(value);
}

export function isAvailability(value: string | null | undefined): value is Availability {
  return value != null && (AVAILABILITIES as readonly string[]).includes(value);
}

/** A finite, non-negative amount, or `null` when the input is not one. */
function amount(value: string | null): number | null {
  if (value == null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = amount(value);
  if (parsed === null || parsed < 1) return fallback;
  return Math.min(Math.trunc(parsed), max);
}

/**
 * URL → filter state. Unknown sorts and availabilities fall back to their
 * defaults instead of reaching a select that has no such option (which renders
 * blank) or the API (which rejects an unknown sort).
 */
export function parseCatalogFilters(
  params: CatalogParams,
  defaults: { readonly pageSize: number },
): CatalogFilterState {
  const minPrice = Math.max(0, amount(params.get('min')) ?? 0);
  const rawMax = amount(params.get('max'));
  // A negative upper bound would match nothing; a bound below the lower one is
  // contradictory — the lower bound wins, so the two controls never disagree.
  const maxPrice = rawMax === null ? null : Math.max(minPrice, rawMax);
  const availability = params.get('avail');
  const sort = params.get('sort');

  return {
    q: (params.get('q') ?? '').trim(),
    category: (params.get('category') ?? '').trim(),
    minPrice,
    maxPrice,
    availability: isAvailability(availability) ? availability : 'all',
    sale: params.get('sale') === '1',
    sort: isSortKey(sort) ? sort : 'recommended',
    page: positiveInt(params.get('page'), 1, Number.MAX_SAFE_INTEGER),
    pageSize: positiveInt(params.get('size'), defaults.pageSize, MAX_PAGE_SIZE),
  };
}

/**
 * Filter state → URL params. Every known key is always present (`null` removes
 * it), so a change published with `queryParamsHandling: 'merge'` clears stale
 * params (a page deeper than the new result set, for example) instead of
 * leaving them behind.
 */
export function catalogQueryParams(
  state: CatalogFilterState,
  defaults: { readonly pageSize: number },
): Record<string, string | number | null> {
  return {
    q: state.q || null,
    category: state.category || null,
    min: state.minPrice > 0 ? state.minPrice : null,
    max: state.maxPrice,
    // Legacy param from an earlier filter model; always cleared.
    priceMode: null,
    avail: state.availability !== 'all' ? state.availability : null,
    sale: state.sale ? 1 : null,
    sort: state.sort !== 'recommended' ? state.sort : null,
    page: state.page > 1 ? state.page : null,
    size: state.pageSize !== defaults.pageSize ? state.pageSize : null,
  };
}

/** The last page that can hold `total` items at `pageSize` (never below 1). */
export function lastPageFor(total: number, pageSize: number): number {
  if (!Number.isFinite(total) || total <= 0) return 1;
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
}
