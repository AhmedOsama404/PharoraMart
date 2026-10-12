# OrderDetailPageComponent

## A. Component identity

- Class `OrderDetailPageComponent`, selector `app-order-detail-page`.
- `src/app/features/orders/order-detail-page.component.ts` (+ `.html`, `.scss`).
- Standalone + OnPush; no inputs/outputs; no spec.

## B. Routing and navigation

Route `/orders/:id` with `canActivate: [authGuard]`. Back button via
`routerLink="/orders"`. Scrolls to top on init (arrives from the list).

## C. Purpose and business behavior

Single-order receipt: date, status tag, cash-on-delivery marker, item lines,
money breakdown, delivery address (hotel snapshot). Unknown id renders the
not-found view, never a skeleton.

## D. Template structure

Back button → skeleton → not-found `EmptyState` → detail card (kv rows,
items, totals, address line).

## E. TypeScript functions and lifecycle

- `ngOnInit`: scrolls top, `getById` by snapshot id; error → `ok` with null
  order (renders not-found).
- `dateOf`, `statusLabel`/`statusSeverity` (util), `go(path)`.

## F. Inputs, outputs, and events

None.

## G. Services and dependencies

`OrderService`, `CurrencyService`, `I18nService`, `ScrollService`,
`ActivatedRoute`, `Router`. PrimeNG: Button, Card, Divider, Skeleton, Tag.

## H. State and data flow

Local `state`/`order` signals; read-only snapshot view.

## I. Localization and styling

Translated labels/statuses/dates; simple stacked card; RTL-safe.

## J. Testing

No spec. Future: unknown-id and snapshot-rendering harness specs.

## K. Safe modification guide

- Display snapshot fields only; pricing/address history must never be
  “refreshed” from live data.

## L. Common pitfalls

- Linking items back to PDP by id that may no longer exist (guard with
  fallbacks if added).
