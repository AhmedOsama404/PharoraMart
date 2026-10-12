# ProductCardComponent

## A. Component identity

- Class `ProductCardComponent`, selector `app-product-card`.
- `src/app/shared/components/product-card.component.ts` (+ `.html`, `.scss`).
- Standalone + OnPush; used on home, catalog, PDP related, favorites.

## B. Routing and navigation

No route. Media image and product name link to `/products/:id` via
`routerLink`. The heart button stops propagation so favoriting never
navigates; the add button emits instead of navigating.

## C. Purpose and business behavior

Uniform product tile: framed image with permanent placeholder behind it
(two-stage fallback via `handleImgError`), sale/new badges,
favorite toggle (state from `FavoritesStore`), two-line name, rating/sold/
stock meta, effective price (+ struck original), and an add-to-cart button
(disabled when out of stock). Reports intent upward; owns no cart rules.

## D. Template structure

`article` → linked media (img, badges, heart button with tooltip) → body
(linked name, meta row, price row, `p-button` emitting `add`).

## E. TypeScript functions and lifecycle

- `effective()` / `discount()` — price helpers over the input product.
- `onFav(ev)` — `preventDefault` + `stopPropagation`, emits `favToggle`.
- `onImgError(ev)` — delegates to shared `handleImgError` (picsum attempt,
  then `img-gone` revealing the framed placeholder behind the image).
- No lifecycle hooks or subscriptions.

## F. Inputs, outputs, and events

- `@Input({required}) product: Product` — the tile data; parent must supply.
- `@Output() add: EventEmitter<Product>` — fires on add-button click.
- `@Output() favToggle: EventEmitter<Product>` — fires on heart click.
- Consumers (pages) gate, mutate stores, and toast exactly once.

## G. Services and dependencies

`I18nService` (labels/tooltips), `FavoritesStore` (`has()` for heart state),
`MoneyPipe`, `RouterLink`, PrimeNG Button/Tag/Tooltip.

## H. State and data flow

Stateless besides the input; heart reflects the shared favorites store.

## I. Localization and styling

Translated badges/buttons/tooltips/meta; fixed 4/3 media ratio; hover
lift; RTL-safe (badges/heart use logical insets).

## J. Testing

No spec. Covered by page specs (favorites entry points) and browser runs.
Future: input-rendering + output-emission harness spec.

## K. Safe modification guide

- New tile element: add markup + styles here (all grids inherit it).
- Never mutate cart/favorites here — emit and let the page own the action
  (prevents double toasts/mutations).

## L. Common pitfalls

- Nesting the buttons inside the media anchor (navigation on action click).
- Image fallback without the once-guard (error loop).
- Reading `favorites` into local state instead of `has()` (stale hearts).
