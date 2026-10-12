# ConfirmationPageComponent

## A. Component identity

- Class `ConfirmationPageComponent`, selector `app-confirmation-page`.
- `src/app/features/checkout/confirmation-page.component.ts` (+ `.html`, `.scss`).
- Standalone + OnPush; no inputs/outputs; no spec (covered by order specs +
  browser order placement).

## B. Routing and navigation

Route `/checkout/confirmation/:id` with `canActivate: [authGuard]`.
Reached from checkout submit; `go()` navigates to `/products` and `/orders`.
Scrolls to top on init (arrives from the bottom of the checkout form).

## C. Purpose and business behavior

Post-order summary + next steps: success hero, mock-mode notice, order
number/date/payment, item list, money breakdown, delivery address (hotel,
city, room), and contact cards (WhatsApp pre-filled message, email draft —
both only *open* the external app, never send). Displays the stored order
snapshot, so it always agrees with history.

## D. Template structure

Skeleton → missing-order `EmptyState` → receipt layout (details card +
side column: delivery address, numbered next steps, contact card with honest
hints, continue/view-orders buttons).

## E. TypeScript functions and lifecycle

- `ngOnInit`: scrolls top, loads by route id; unknown id ends in the
  not-found view, never a permanent skeleton.
- `dateOf(iso)` — localized date/time.
- `wa()` / `mail()` — open WhatsApp/email with the prepared message.
- `go(path)` — continue shopping / view orders.

## F. Inputs, outputs, and events

None (page-level).

## G. Services and dependencies

`OrderService` (snapshot), `ContactService` (message + links, mode-gated),
`CurrencyService` (money/dates), `ScrollService`, `ActivatedRoute`,
`Router`, `I18nService`. PrimeNG: Button, Card, Divider, Message, Skeleton.

## H. State and data flow

Local `state`/`order` signals; read-only view over the stored order.

## I. Localization and styling

All copy via `i18n.t`; contact buttons/hints gated by `contact.mode`;
two-column → one column ≤960px; RTL-safe.

## J. Testing

No spec. Covered by `order.service.spec` (creation/listing) and the
browser order-placement run. Future: harness spec for unknown-id view.

## K. Safe modification guide

- New receipt field: read it from the `Order` snapshot (never recompute).
- New contact channel: only WhatsApp/email are supported — anything else
  needs a business decision first.

## L. Common pitfalls

- Claiming a message was “sent” (only the app was opened).
- Recomputing totals here instead of displaying the snapshot.
