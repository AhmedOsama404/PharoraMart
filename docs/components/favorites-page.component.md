# FavoritesPageComponent

## A. Component identity

- Class `FavoritesPageComponent`, selector `app-favorites-page`.
- `src/app/features/favorites/favorites-page.component.ts` (+ `.html`, `.scss`).
- Standalone + OnPush; no inputs/outputs.
- Spec: `favorites-page.component.spec.ts` (single-mutation entry points).

## B. Routing and navigation

Route `/favorites` with `canActivate: [authGuard]` (favorites require
sign-in; guests are returned here after login). `go()` navigates to
`/products`. No scroll handling (list continuity).

## C. Purpose and business behavior

Saved-products page: empty state or a grid of `ProductCard`s, each paired
with an explicit “Move to cart” button. Removing unfavorites via the heart.
Both add entry points run the **same single central mutation**
(`CartStore.add`): one click affects exactly one line; repeats accumulate
qty on that line instead of duplicating it.

## D. Template structure

Title/subtitle → empty `EmptyState` (browse action) → grid of `.fav-card`
(card + move-to-cart button each).

## E. TypeScript functions and lifecycle

- Constructor loads the catalog snapshot once (`products.all()`).
- `items` — catalog products filtered by saved ids (vanished products drop
  out instead of crashing).
- `moveToCart(p)` — skips out-of-stock, adds 1 unit, success toast.
- `remove(p)` — unfavorites + toast. `go(path)`.

## F. Inputs, outputs, and events

None (page-level; card `(add)`/`(favToggle)` outputs handled above).

## G. Services and dependencies

`ProductService`, `CartStore`, `FavoritesStore`, `NotificationService`,
`Router`, `I18nService`. PrimeNG: Button + card/empty children.

## H. State and data flow

Reads `favorites.ids()` + catalog; mutates both central stores; header
count updates via signals.

## I. Localization and styling

All copy via `i18n.t`. Grid 4→3→2→1; card + button stacked per item.

## J. Testing

4 specs: one-line-per-click per entry point, variant separation, no
cross-product merging. Run:
`npx ng test --include='**/favorites-page.component.spec.ts'`.

## K. Safe modification guide

- New favorite action: call the store method once and toast once (never add
  a second mutation path).
- Keep both buttons wired to `moveToCart`; do not nest one inside the other
  (event-bubbling double adds).

## L. Common pitfalls

- Bypassing `CartStore.add` with ad-hoc line building (breaks identity).
- Toasting in both card and page layers (flood — one layer owns it).
