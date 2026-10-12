# Cart and Checkout

## Data model

- `CartLine` (`models/cart.model.ts`): `{ key, productId, variantKey?,
  variantLabel?, qty }`. `key = productId` or `productId::variantKey`
  (`cartLineKey()`). The key is the **only** identity — see
  [State Management](./STATE_MANAGEMENT.md) for the binding rule.
- `EnrichedCartLine` (`cart-view.service.ts`): the stored line joined with
  the catalog (`product | null`, `unit`, `lineTotal`, `unavailable`).

## Badge, page, checkout agreement

All three derive from `CartStore.lines()`:
badge = `count()` (Σ qty, all lines); page and checkout render
`CartViewService.lines()` (one row per stored line). Unknown product ids
(stale storage, removed products) render as **unavailable rows**
(`cart.unavailable`, priced 0, removable) so nothing silently vanishes.
Money (`pricedSubtotal`) uses available lines only.

## Quantity behavior

`add()` merges into the existing line and clamps to live stock; `setQty`
clamps to `[1, stock]`; qty selector maxes at stock with a “only N available”
note. Out-of-stock products cannot be added (buttons disable + guards).

## Persistence and hydration

`localStorage: novamart.cart.v1` (array of plain `CartItem`). Written
synchronously after every mutation; read once at store construction with
per-item validation (bad entries skipped). Because load runs once and writes
follow every mutation, hydration cannot overwrite newer actions.

## Delivery quotes and totals

Hotel unknown on the cart page → subtotal + “calculated at checkout” note.
At checkout, `DeliveryService.quoteFor(hotelId)` is the **only** fee writer
(driven by the select’s `(onChange)`); totals = priced subtotal + quoted fee
(0 above `freeShippingThreshold`). Unknown/inactive hotel or failed quote
blocks submit with an error — never a guessed fee. Switching cities resets a
foreign-city hotel selection.

## Checkout validation and submission

Reactive Form: required name (≥3), phone pattern, optional valid email,
required city + hotel, optional room/notes/contact method. `markAllAsTouched`
on invalid submit. Double-submit guard (`placing()` + info toast) plus a
per-attempt idempotency key (`OrderService.create(req, key)` dedupes).

## Notifications ownership

Pages announce their own outcomes (`addedToCart`, `itemRemoved`,
`orderSuccess`, …) exactly once per logical action.
`NotificationService` collapses **identical** messages inside 1.2 s so rapid
taps show one toast; distinct messages (including errors) always pass.
State rerenders never emit notifications.

## Duplicate-action prevention

- One central mutation (`CartStore.add`); both favorites buttons and all
  product cards call the same method once per click (verified: +1 unit/click,
  merged into one line).
- Pending actions execute exactly once (`consume()` clears before running).
- Checkout placement is idempotent (button disable + key + service dedup).

## Troubleshooting: badge shows a count but the cart page looks empty

1. Open DevTools → Application → Local Storage → `novamart.cart.v1`.
2. Compare stored `productId`s with the catalog (`/products` renders them).
3. If ids are unknown (old app version, removed product): the page now shows
   them as **“No longer available” rows** — remove them to clear the badge.
   (Before this fix, such rows were silently dropped while the badge kept
   counting: the reported bug. Regression test:
   `cart-view.service.spec.ts` “renders every stored line”.)
4. If ids are valid but rows are missing: check `CartViewService` status
   (loading skeleton vs error + Retry) and the console for catalog failures.
