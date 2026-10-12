# NotificationService

- File: `src/app/core/services/notification.service.ts`. Spec: `notification.service.spec.ts`.
- Root singleton; owns toast policy (single announcer).

## Responsibility

Localized PrimeNG toasts with a deliberate dedup policy: exact repeats
(same kind + key + detail + params) inside 1.2 s are collapsed to one;
distinct messages — including errors — always pass. Pages announce their own
outcomes exactly once; state rerenders never notify.

## Public API

- `show(kind, summaryKey, detail?, params?)`, `success/error/info`
  shorthands, `raw(kind, summary, detail)` (pre-translated), `clear()`
  (also resets dedup memory).

## Dependencies

PrimeNG `MessageService` (rendered by the global `<p-toast>` host in
`MainLayoutComponent`), `I18nService` (key resolution at show time, so
toasts follow language switches).

## Consumers

Every page action (cart/favorites/auth/checkout/orders), guard-adjacent
`PendingActionService.explain`, quote failures.

## Tests

Rapid-repeat collapse, window expiry, distinct pass-through, error dedup
without hiding, `clear()` reset.

## Safe extension

New notification kind: extend `ToastKind` + severity mapping. Keep one
announcer — never toast from both a child and its page for one action.
