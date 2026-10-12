# PendingActionService

- File: `src/app/core/services/pending-action.service.ts`. Spec: `pending-action.service.spec.ts`.
- Root singleton; guest → sign-in → continue journey.

## Responsibility

Typed return intents (`{ returnUrl, reason, action? }`) with exactly-once
execution. Reasons double as `gate.*` translation keys.

## Public API

- `request(url, reason, action?)`, `peek()`, `consume()` (returns + clears
  atomically), `clear()`, `pending` (readonly signal for banners).
- `requireAuth(reason, returnUrl, action?)` — page-entry gate: `true` when
  signed in, else stores intent + explanation toast + login redirect, `false`.
- `explain(reason)` — localized `gate.*` info toast.
- `runAction(action?)` — executes once after arrival: favorites add directly;
  cart adds re-resolve the product (live-stock clamp, friendly errors for
  gone/out-of-stock products).
- `safeReturnUrl()` — accepts internal paths only (rejects schemes,
  `//`, backslashes, `/auth/*` loops).

## Dependencies

`AuthService` (gate check), `Router` (redirect), `ProductService`,
`CartStore`, `FavoritesStore`, `NotificationService`. No cycles (nothing
points back into this service except pages/guard).

## Lifecycle, errors, persistence

In-memory signal only — refresh clears intents by design (no stale actions).
`runAction` failures toast, never throw.

## Consumers

`authGuard`, home/catalog/PDP gates, login/register pages (banner +
`completeSignIn/Up`: consume → navigate → run).

## Tests

URL matrix, authed passthrough, guest redirect + intent, exactly-once
consume, favorite/cart completion, stock clamp, vanished product.

## Safe extension

New gated action: extend `PendingShoppingAction` + `runAction` + gate reason
(+ `gate.*` keys in all eight dictionaries).
