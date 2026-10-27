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

/**
 * Price-rail geometry. The rail is a shortcut, never a cage: its axis must
 * reach the priciest product in the catalogue and the typed bounds stay
 * uncapped, so the two values below are derived per render from whatever the
 * visitor currently means, not frozen from the server's answer.
 */

/** Ceilings a shopper would say out loud — 1.2 and 1.5 included, so a 149 catalogue ends at 150 rather than 200. */
const CEILING_LADDER = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** Tick sizes for the same reason, coarser: a rail handle must be grabbable. */
const STEP_LADDER = [1, 2, 5, 10] as const;

/** Handle travel per unit of axis — a fine enough rail to land on 0.33. */
const RAIL_STOPS = 60;

/** The smallest ladder value at or above `amount`, scaled to its own decade. */
function ladderCeil(amount: number, ladder: readonly number[]): number {
  const magnitude = 10 ** Math.floor(Math.log10(amount));
  const normalized = amount / magnitude;
  // The tolerance is for the decade itself: 0.3 / 0.1 arrives as 3.0000000004
  // and a ceiling that silently becomes the next rung is a rail that lies
  // about its own top.
  const rung = ladder.find((value) => normalized <= value + 1e-9) ?? ladder[ladder.length - 1];
  return Number((rung * magnitude).toPrecision(12));
}

/**
 * `amount` rounded up onto a legible number. Never below `amount` (the axis has
 * to reach the priciest product) and never more than about 25% above it (an
 * axis that dwarfs its data would squash every handle to the left).
 */
export function niceCeil(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return ladderCeil(amount, CEILING_LADDER);
}

/**
 * The step a rail spanning `range` should move in: about `RAIL_STOPS` stops,
 * snapped up to a round number. A 100 ceiling steps by 2, a 0.4 one by 0.01 —
 * so a fraction as small as 0.33 stays one drag away.
 */
export function niceStep(range: number): number {
  if (!Number.isFinite(range) || range <= 0) return 1;
  return ladderCeil(range / RAIL_STOPS, STEP_LADDER);
}
