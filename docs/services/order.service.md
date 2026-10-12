# OrderService (mock orders)

- File: `src/app/core/services/order.service.ts`. Spec: `order.service.spec.ts`.
- Root singleton; mock order book (development-only persistence).

## Responsibility

Local order creation/listing with the production rules pre-applied:
idempotency keys, cash-on-delivery only, server-shaped records.

## Public API

- `create(req, idempotencyKey, userId?)` — rejects empty orders; returns the
  existing record for a repeated key (duplicate-submission proof);
  order numbers `NM-YYYY-####`, status `pending`.
- `list()` (newest first), `getById(id|orderNumber)` (`not-found` error).
- `placing` signal (in-flight state for tests/UX).

## Dependencies

None besides `localStorage: novamart.orders.v1`.

## Consumers

Checkout submit, confirmation, orders pages.

## Tests

Creation shape, idempotent re-create (one record), empty rejection,
list/get round-trip.

## Safe extension

`POST /orders` with the `Idempotency-Key` header; backend must validate
auth/stock/prices/fees and recompute totals (never trust client money).
