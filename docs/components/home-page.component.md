# HomePageComponent

## A. Component identity

- Class `HomePageComponent`, selector `app-home-page`.
- `src/app/features/home/home-page.component.ts` (+ `.html`, `.scss`);
  route file `home.routes.ts`. Standalone + OnPush; no inputs/outputs; no spec.

## B. Routing and navigation

Route `''` (default child of the layout). Navigates to `/products` (plain or
`?sale=1`) via `go()`/`goSale()`; product links are `routerLink`s on cards;
`scrollTo()` smooth-scrolls to the category section in-page.

## C. Purpose and business behavior

Storefront landing: hero (headline, CTAs, perks), category cards, featured /
new-arrival (carousel) / popular grids, sale promo band, and recently-viewed
(when local history exists). Add-to-cart and favorite actions are
**account-gated** via `PendingActionService.requireAuth` (guests go through
sign-in, then the action completes).

## D. Template structure

Hero (copy + hero product card + tiles) → categories grid (skeletons while
loading) → featured grid → promo band → new-arrival carousel → popular grid →
recently-viewed grid (conditional). `app-section-header` + `app-product-card`
throughout; `MoneyPipe` for the hero price.

## E. TypeScript functions and lifecycle

- `ngOnInit` fires independent section requests in parallel
  (`categories()`, `featured()` → also derives hero/sale picks and clears
  `loading`, `newArrivals()`, `popular()`, catalog join for recent ids).
- `addToCart(p)` — guards stock, gates auth, adds 1 unit, success toast.
- `toggleFav(p)` — gates auth, toggles, success toast.
- `go(path)` / `goSale()` / `scrollTo(el)` / `fbImg(ev)` (picsum fallback,
  guarded against error loops).
- `carouselOpts` — responsive visible/scroll counts (4/3/2/1).
- Signals per section; no manual subscription cleanup needed for `HttpClient`
  -free mock observables (all complete).

## F. Inputs, outputs, and events

None (page-level; child outputs handled in `addToCart`/`toggleFav`).

## G. Services and dependencies

`ProductService` (all sections), `CartStore`, `FavoritesStore`,
`NotificationService`, `RecentlyViewedService`, `Router`, `I18nService`.
PrimeNG: Button, Carousel, Skeleton, Tag.

## H. State and data flow

Section signals render independently as each request resolves. Cart/favorite
mutations go to the central stores; badge/header update via signals.

## I. Localization and styling

All copy via `i18n.t`; category names/descriptions via
`categoryName()/categoryDescription()` (localized data + English fallback).
Gradient hero panel, responsive grids (4→3→2→1), promo band; RTL-safe.

## J. Testing

No spec. High-value future specs: gated add (guest → intent stored),
skeleton→content transition. Browser smoke covers it.

## K. Safe modification guide

- New homepage section: add a signal + request in `ngOnInit` + section block
  (reuse `app-section-header` + `app-product-card`).
- New card action: gate with `requireAuth` (same pattern as `addToCart`).
- Changing hero content: copy lives in `hero.*` keys (all eight languages).

## L. Common pitfalls

- Calling cart/favorites mutations without the auth gate (breaks the
  guest→sign-in→continue journey).
- Forgetting `track p.id` on new grids (rerender churn).
