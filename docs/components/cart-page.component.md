# CartPageComponent

## A. Component identity

- Class `CartPageComponent`, selector `app-cart-page`.
- `src/app/features/cart/cart-page.component.ts` (+ `.html`, `.scss`).
- Standalone + OnPush; no inputs/outputs.
- Spec: `cart-page.component.spec.ts` (translated summary, unavailable rows, AR/RTL).

## B. Routing and navigation

Route `/cart` (**public** — guests may view; placing the order requires
sign-in via the guarded `/checkout`). `go()` navigates to `/products` and
`/checkout`. No scroll handling (list continuity is correct here).

## C. Purpose and business behavior

Cart review: rows with image/name/variant/unit price, stock-clamped quantity
selector, line totals, remove, clear-with-confirmation, subtotal, “calculated
at checkout” delivery note, free-shipping threshold hint, total (= subtotal —
fee unknown until a hotel is quoted), and checkout CTA. Rows come from
`CartViewService`: every stored line renders; unknown products render as
explicit **unavailable rows** (removable, priced 0) so badge and page agree.

## D. Template structure

Title/subtitle → loading skeletons → error `EmptyState` (retry) → empty
`EmptyState` → layout: lines column (available cards + unavailable cards +
continue/clear row) + sticky summary card (hint, subtotal, delivery note,
total, checkout button).

## E. TypeScript functions and lifecycle

- `subtotal` = `view.pricedSubtotal()`; `freeShipHint` from subtotal vs
  `freeShippingThreshold` (formatted missing amount).
- `retry()` → `view.refresh()` (catalog reload after error).
- `setQty(key, qty, max)` (clamped), `remove(key)` (+ toast),
  `askClear()` (confirm dialog → clear + toast), `go(path)`.
- No constructor fetching, no manual subscriptions (view service owns them).

## F. Inputs, outputs, and events

None (page-level).

## G. Services and dependencies

`CartStore` (mutations, `isEmpty`), `CartViewService` (rows, subtotal,
status), `CurrencyService` (hint formatting), `NotificationService`,
`ConfirmationService`, `Router`, `I18nService`. PrimeNG: Button, Card,
Divider, Message, Skeleton + qty/empty/money children.

## H. State and data flow

`CartViewService.lines()` → rows; `pricedSubtotal()` → money; badge (header)
reads the same store, so all three agree by construction. Mutations persist
synchronously to `novamart.cart.v1`.

## I. Localization and styling

Summary heading `confirmation.totals` (the `checkout.totals` namespace bug
lived here — see TROUBLESHOOTING). All rows/labels translated incl.
`cart.unavailable`. Grid rows collapse on ≤900px; unavailable rows dimmed;
RTL mirrors automatically.

## J. Testing

4 specs: translated Totals heading (fails on the raw key), translated money
rows, unavailable-row rendering, Arabic RTL rendering. Run:
`npx ng test --include='**/cart-page.component.spec.ts'`.

## K. Safe modification guide

- New row action: add a store method first, then wire the button + toast.
- New summary row: derive from `view` data (never a second copy of totals).
- Changing empty/loading/error branches: keep the four states distinct.

## L. Common pitfalls

- Re-introducing a local catalog join (two joins drift apart — the service
  is the single join).
- Pricing unavailable rows (they must stay 0) or dropping them silently
  (recreates the badge/page mismatch).
- Forgetting `ConfirmationService` needs the global `<p-confirmDialog>`
  host in `MainLayoutComponent`.
