# OrdersPageComponent

## A. Component identity

- Class `OrdersPageComponent`, selector `app-orders-page`.
- `src/app/features/orders/orders-page.component.ts` (+ `.html`, `.scss`).
- Standalone + OnPush; no inputs/outputs; no spec.

## B. Routing and navigation

Route `/orders` with `canActivate: [authGuard]` (account-specific history).
Rows link to `/orders/:id` via `routerLink`. `go()` navigates to
`/products` for the empty state.

## C. Purpose and business behavior

Mock order history (newest first): order number, date, item count, cash-on-
delivery marker, status tag, total, details button; empty state with shop
action. Read-only over `OrderService.list()`.

## D. Template structure

Title/subtitle → loading skeletons → empty `EmptyState` → card list rows
(meta + status `p-tag` + total + view button).

## E. TypeScript functions and lifecycle

- `ngOnInit` loads the list, then sets `ok` (error path not distinguished —
  mock source; future API should add an error state).
- `dateOf` (localized), `itemCount` (Σ qty), `statusLabel`/`statusSeverity`
  (delegated to `order-status.utils`), `go(path)`.

## F. Inputs, outputs, and events

None.

## G. Services and dependencies

`OrderService`, `CurrencyService`, `I18nService`, `Router`. PrimeNG: Button,
Card, Skeleton, Tag.

## H. State and data flow

Local `state`/`orders` signals; read-only.

## I. Localization and styling

All labels/statuses translated (`orders.status*` via util). Rows collapse
to 2 columns ≤700px.

## J. Testing

No spec. Covered by `order.service.spec` (list ordering). Future: harness
spec for empty vs list rendering.

## K. Safe modification guide

- New row field: read from the `Order` snapshot.
- Status changes: extend `order-status.utils`, not this component.

## L. Common pitfalls

- Computing totals here instead of displaying stored ones.
