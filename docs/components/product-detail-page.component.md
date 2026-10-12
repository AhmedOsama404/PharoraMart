# ProductDetailPageComponent

## A. Component identity

- Class `ProductDetailPageComponent`, selector `app-product-detail-page`.
- `src/app/features/products/product-detail-page.component.ts` (+ `.html`, `.scss`).
- Standalone + OnPush; no inputs/outputs.
- Spec: `product-detail-page.component.spec.ts` (13 regression tests).

## B. Routing and navigation

Route `products/:id` (no `titleKey` — the page sets its own title from the
product name). The component instance is **reused** across products: the id
is read as `productId$` (`paramMap` → trim → `distinctUntilChanged`) plus a
`productId` signal. Related-product cards navigate via `routerLink`, which
re-triggers the pipeline without destroying the page. A reset effect scrolls
to top instantly on every id change (see `ScrollService` rationale).

## C. Purpose and business behavior

Renders one product terminally: `loading → ready | not-found | error`
(`ProductDetailState`, never bare booleans). Gallery, tags, price/discount,
stock states, localized category link, variant selects, stock-clamped
quantity, gated add-to-cart/favorite, description/spec tabs, related
products. Superseded requests are cancelled (`switchMap`); related failures
never fail the page; malformed/empty responses become `not-found`; retry
re-runs the current id.

## D. Template structure

Skeleton → not-found `EmptyState` → error `EmptyState` (retry) → ready:
breadcrumb (`crumbs()`), gallery (main + thumbnails), info column (tags,
`h1`, rating/sold/SKU meta, price, stock, category link, variants, qty,
CTAs, tabs), related grid. `MoneyPipe` throughout; `product()!` only appears
inside the ready branch.

## E. TypeScript functions and lifecycle

- `productId$` / `productId` — route id as observable + signal.
- `page = toSignal(reloadNonce → productId$ → loadState)` — the cancellable
  loader; `toSignal` owns teardown (no manual unsubscribe).
- `loadState(id)` — empty id → `not-found`; `getById` → shape guard →
  `related()` (own `catchError` → `[]`) → `catchError` maps `not-found`
  vs `error`; always starts with `LOADING_STATE`. Never rejects.
- Constructor effects: (1) per-id UI reset (scroll top, image/qty/variants/
  option cache) with `allowSignalWrites`; (2) title + recently-viewed on
  `ready` only.
- `crumbs` — memoized `computed` with frozen `CRUMB_MATCH_*` constants
  (per-cycle objects here once caused an infinite CD loop — do not revert).
- `variantOptions(id, options)` — cached per variant (stable `p-select`
  references); `variantSelection()` joins picks into key/label.
- `addToCart` (gated, qty+variant preserved in the intent),
  `toggleFav`/`quickFav` (gated), `quickAdd` (gated; returns to the current
  page while adding the related product), `retry()` (bumps `reloadNonce`),
  `goHome()`, `fbImg(ev, seed)` (shared two-stage recovery; gallery frames
  own their aspect boxes with permanent placeholders).
- Derived `computed`s: `product`, `images`, `effective`, `discount`,
  `availability`, `categoryName`, `isFav` (tracks `favorites.ids()`).

## F. Inputs, outputs, and events

None (page-level; child outputs handled in the methods above).

## G. Services and dependencies

`ProductService` (product + related + category names), `CartStore`,
`FavoritesStore`, `NotificationService`, `PendingActionService` (gates),
`RecentlyViewedService`, `ScrollService`, `ActivatedRoute`, `Router`,
`I18nService`. PrimeNG: Breadcrumb, Button, Select, Skeleton, Tabs family,
Tag + card/qty/header/empty/money children.

## H. State and data flow

Route id → `loadState` → single `page()` state → template branches.
Per-product UI in signals, variant picks in a plain object (reset by the
effect). Mutations go to central stores; toasts fire once per action.

## I. Localization and styling

All copy via `i18n.t`; category/variant/qty labels localized; `dir`-safe
grid (1.05fr/1fr → 1fr ≤960px; related 4→2→1). Thumbnails are real buttons
with image-position labels.

## J. Testing

13 specs: skeleton/success/not-found/blank-id/null-product/error+retry
(through real template wiring), rapid-navigation cancellation (teardown
count), A→B→C finality, history-return reload, related-failure tolerance,
crumb reference stability. Run:
`npx ng test --include='**/product-detail-page.component.spec.ts'`.

## K. Safe modification guide

- New product field: extend the model + mock/API + ready-branch markup.
- New purchase option: fold into `variantSelection()` (identity must stay
  `productId::variantKey`).
- Never rebuild `crumbs()`/`variantOptions()` per cycle; never subscribe
  manually to `productId$` (the pipeline owns cancellation).

## L. Common pitfalls

- `|| !page().product` placed before the error branch makes `error`
  unreachable (caught once by the retry spec — branch order matters).
- Nested manual subscriptions instead of the `switchMap` pipeline (stale
  data, leaks).
- Forgetting the scroll reset (page stays at related-products depth).
