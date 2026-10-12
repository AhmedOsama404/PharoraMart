# CheckoutPageComponent

## A. Component identity

- Class `CheckoutPageComponent`, selector `app-checkout-page`.
- `src/app/features/checkout/checkout-page.component.ts` (+ `.html`, `.scss`);
  route file `checkout.routes.ts`.
- Standalone + OnPush; no inputs/outputs.
- Spec: `checkout-page.component.spec.ts` (fee display, hotel-required block,
  quote-failure block, hotel-snapshot submit).

## B. Routing and navigation

Route `/checkout` with `canActivate: [authGuard]` (guests are sent to login
and return with the cart intact — cart persistence makes this lossless).
`go()` navigates to `/products` and `/cart`. Scrolls to top on init
(entered from the cart's bottom action). On success navigates to
`/checkout/confirmation/:id`.

## C. Purpose and business behavior

Cash-on-delivery order placement (the **only** payment method): contact form,
hotel destination (city + searchable hotel + room + notes), quoted delivery
fee, review of orderable lines, totals, idempotent submit. Unavailable cart
lines render as disabled rows and are **excluded** from the order. Submit is
blocked without a trustworthy fee (no hotel / failed quote) instead of
charging a guess.

## D. Template structure

Empty-cart `EmptyState` (when the store is empty) else form grid: contact
card → destination card (city select, filterable hotel select with fee in
labels, room, notes) → cash-on-delivery card → sticky summary (orderable
lines, unavailable rows, subtotal, quoted fee or “calculated” note, total,
submit error, place-order button with loading state, back-to-cart).

## E. TypeScript functions and lifecycle

- `form` (Reactive Form): required name ≥3, phone pattern, optional email,
  required city + `hotelId`, optional room/notes/contactMethod.
- `cities`/`hotels` signals load in the constructor; `cityOptions` /
  `hotelOptions` / `contactOptions` are memoized `computed` (stable
  `p-select` references; fee labels via cached `Intl` formatting).
- `ngOnInit` scrolls top. `onHotelChange` → `refreshQuote`;
  `onCityChange` → `selectedCity` + resets foreign-city hotels (with fee
  reset). `refreshQuote` publishes to `quotedFee` or sets `quoteFailed`
  (+ toast) — the **only** fee writer.
- `lines` (orderable review rows from the cart view),
  `unavailableLines`, `subtotal` (= priced subtotal), `deliveryFee`
  (threshold → 0 else quoted), `total`.
- `submit()`: duplicate guard (`placing()` + info toast) → validate
  (touch all) → require orderable lines → require trustworthy fee →
  idempotency key → snapshot customer (hotel **name**, not just id) →
  `orders.create` → clear cart → success toast → confirmation. Failures set
  `submitError` + error toast and keep entered data.
- `err(name)` maps control errors to `validation.*` keys.

## F. Inputs, outputs, and events

None (page-level; select `onChange` outputs handled above).

## G. Services and dependencies

`CartStore` (lines, clear), `CartViewService` (review rows, subtotal),
`DeliveryService` (directory + quotes), `OrderService`, `AuthService`
(prefill + user id), `NotificationService`, `CurrencyService`,
`ScrollService`, `Router`, `I18nService`, `FormBuilder`. PrimeNG: Button,
Card, Divider, InputText, Message, Select, Textarea.

## H. State and data flow

Form state (user input) + quote state (`quotedFee`/`quoteFailed`) + cart
view (lines/money). The order sent is a snapshot (hotel name, prices);
later catalog changes cannot alter it.

## I. Localization and styling

All labels/validation/notes via `i18n.t` (`checkout.*`, `cart.*`,
`validation.*`). City/hotel selects are filterable with localized
placeholders/empty messages. Two-column → one column ≤960px; `grid2` → one
column ≤560px. RTL-safe.

## J. Testing

4 specs listed above. High-value additions: city-switch resets foreign
hotel; double submit creates one order. Run:
`npx ng test --include='**/checkout-page.component.spec.ts'`.

## K. Safe modification guide

- New customer field: extend `CheckoutFormValue` + form control + template
  field + validation + submit mapping + confirmation display + WhatsApp
  message + order specs (see feature guide §10).
- New pricing rule: implement in `DeliveryService`/quote boundary — never
  `if/else` on hotels in this component.
- Hotels are referenced by stable `hotelId`; display uses the snapshot name.

## L. Common pitfalls

- Reading fee from anything but `quotedFee()` (two fee sources drift).
- Subscribing to `valueChanges` for selects here: proven silent in this
  PrimeNG setup — use the `(onChange)` handlers.
- Rebuilding option arrays per cycle (Select resync churn).
- Forgetting `hotelName` in the snapshot (ids alone are unreadable in
  history/emails).
