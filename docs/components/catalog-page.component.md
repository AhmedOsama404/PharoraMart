# CatalogPageComponent

## A. Component identity

- Class `CatalogPageComponent`, selector `app-catalog-page`.
- `src/app/features/products/catalog-page.component.ts` (+ `.html`, `.scss`).
- Standalone + OnPush; no inputs/outputs; no spec (utils covered in
  `catalog.utils.spec.ts`).

## B. Routing and navigation

Route `products` (`products.routes.ts`). State lives in query params
(`q, category, min, max, avail, sale, sort, page`) — bookmarkable,
back/forward-safe. Writes use `replaceUrl` + merge so typing never pollutes
history. No scroll on filter changes (user stays at the filters); paginator
smooth-scrolls to top via `ScrollService`.

## C. Purpose and business behavior

Full catalog: search (350 ms debounce), category/price/availability/sale
filters, six sort modes, pagination, active-filter chips, clear-all, result
count, loading skeletons, empty and error states with retry. Category options
come from `ProductService.categories()` (data-driven, never hardcoded).
Add-to-cart/favorite are account-gated (`requireAuth`).

## D. Template structure

Breadcrumb-ish crumbs → header + mobile filters button → toolbar (search,
sort) → active chips → two-column layout (sticky filter sidebar with an
`ng-template` body reused by the mobile drawer; results grid / skeleton /
empty / error + paginator).

## E. TypeScript functions and lifecycle

- `ngOnInit` subscribes to `queryParamMap`: every URL change rebuilds the
  `draft` signals and `reload()`s (URL is the source of truth).
- `currentQuery()` maps draft → `CatalogQuery`; `pushUrl()` writes the draft
  back (nulls drop defaults); `refresh()` resets to page 1.
- Setters (`setSort/setCategory/setMaxPrice/setMinPrice/setAvail/setSale`,
  `onSearchType` debounced, `onPage`, `removeChip`, `clearAll`).
- `reload()` → `products.list()` → `items/total/state` (error → error state).
- `addToCart`/`toggleFav` (gated, single toast each).
- `searchTimer` is component-local (cleared before reset); the route
  subscription lives with the page (no manual teardown needed for a routed
  component destroyed on leave — but see pitfalls).

## F. Inputs, outputs, and events

None (page-level).

## G. Services and dependencies

`ProductService`, `CartStore`, `FavoritesStore`, `NotificationService`,
`ScrollService`, `PendingActionService`, `ActivatedRoute`, `Router`.
PrimeNG: Button, Checkbox, Chip, Drawer, IconField, InputText, Paginator,
Select, Skeleton, Slider + `ProductCard`, `EmptyState`.

## H. State and data flow

Draft signals ↔ URL ↔ `products.list()` → `items/total/state`. Cart/favorite
mutations go to central stores. `categoryOptions/sortOptions/availOptions`
are memoized `computed` (stable PrimeNG references).

## I. Localization and styling

All labels/options/validation via `i18n.t`; category labels resolve through
`products.categoryName()` (localized). Sidebar sticky on desktop, drawer on
≤860px; grids 3→2→1. RTL-safe logical properties.

## J. Testing

No page spec; `catalog.utils.spec.ts` covers filter/sort/search/pagination
logic. Future: harness spec for URL↔draft sync. Run
`--include='**/catalog.utils.spec.ts'`.

## K. Safe modification guide

- New filter: add a draft signal + URL param (read + write) + `CatalogQuery`
  support in `catalog.utils.ts` + option UI in the shared `filterBody`
  template (shows in sidebar *and* drawer automatically).
- New sort mode: extend `SortKey` + `sortProducts` + `sortOptions`.
- Keep option lists as `computed`, never per-call methods.

## L. Common pitfalls

- Forgetting either URL direction (read or write) breaks bookmarks/back.
- Method-built select options per change-detection cycle (render-loop class).
- Debounce timer leaking across rapid typing (always clear before reset).
