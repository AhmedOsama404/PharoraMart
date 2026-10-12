# HeaderComponent

## A. Component identity

- Class `HeaderComponent`, selector `app-header`.
- `src/app/layout/header.component.ts` (+ `.html`, `.scss`).
- Standalone + OnPush; no inputs/outputs; no spec (covered by browser smoke).

## B. Routing and navigation

No route; embedded in `MainLayoutComponent` on every page. Navigates to `/`,
`/products` (with `q` query for search), `/cart`, `/favorites`, `/orders`,
`/auth/*` via `RouterLink` and `router.navigate`. Does not touch scroll.

## C. Purpose and business behavior

The persistent storefront bar: brand, primary links, live product search with
suggestions, language + currency selectors, favorites/cart badges, account
menu (or sign-in link), and a mobile drawer with the same destinations.
Enforces no business rules itself; favorites/cart links land on guarded
routes when the guest is not signed in.

## D. Template structure

Announcement strip; main bar (menu button ≤1024px, logo, links, search with
suggestion dropdown + clear button, two `p-select`s, favorites/cart icon
buttons with conditional `p-badge`s, account menu or login link); mobile
search row (≤768px); `p-drawer` with the mobile nav and duplicated selectors.

## E. TypeScript functions and lifecycle

- Constructor wires `search$` through `debounceTime(250)` →
  `distinctUntilChanged` → `switchMap(suggestions|of([]))`; stale keystrokes
  are dropped, empty input yields no dropdown. (App-lifetime component; the
  subscription intentionally has no teardown.)
- `onSearchInput(term)` — feeds the pipeline.
- `goSearch()` — closes suggestions, navigates to `/products?q=…`.
- `clearSearch()` — resets input/suggestions, navigates to bare `/products`.
- `closeSuggestions()` — hides the dropdown (used after picking a result).
- `onLang(lang)` / `onCurrency(code)` — persist selection via services.
- `doLogout()` — clears session, closes drawer, navigates home.
- Signals: `mobileOpen`, `suggestions`, `showSuggestions`; plain
  `searchTerm`/`langModel`/`currencyModel` (ngModel, event-driven).
- `langOptions`, `accountItems` are memoized `computed` (stable PrimeNG
  references — see the breadcrumb-loop pitfall).

## F. Inputs, outputs, and events

None (reads stores/services directly).

## G. Services and dependencies

`I18nService` (labels, switching), `CurrencyService` (currency list),
`CartStore`/`FavoritesStore` (badge counts), `AuthService` (menu vs link,
logout), `ProductService.suggestions` (dropdown), `Router`. PrimeNG:
Badge, Drawer, IconField/InputIcon/InputText, Menu, Select.

## H. State and data flow

Reads shared signals; writes only UI-local state (`mobileOpen`,
suggestions) plus language/currency/session through their owners.

## I. Localization and styling

All labels via `i18n.t` (nav, placeholders, menu, drawer). Language options
render in all eight languages. Responsive: links collapse ≤1024px, search
moves to its own row and selectors move into the drawer ≤768px. Badges are
absolutely positioned on icon buttons (mirrored in RTL via logical CSS).

## J. Testing

No spec. Covered by browser smoke (badges, search, switching, drawer).
If changed: re-verify at 390/768/1280 in EN + AR.

## K. Safe modification guide

- New nav link: add the anchor (desktop `.links` + drawer `.mobile-nav`).
- New selector option list: expose it as a `computed`, never a per-call
  method (unstable references resync PrimeNG inputs every cycle).
- New header action: keep it presentation-only; put rules in services.

## L. Common pitfalls

- Method-built `options` arrays for `p-select` (see product-detail loop).
- Forgetting the mobile drawer duplicate when adding desktop-only controls.
- Subscribing in the constructor is fine here (never destroyed); do not copy
  this pattern into pages without `takeUntilDestroyed`.
