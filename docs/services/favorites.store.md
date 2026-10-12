# FavoritesStore

- File: `src/app/core/services/favorites.store.ts`. Spec: `favorites.store.spec.ts`.
- Root singleton; authoritative favorites state (requires sign-in at the UI layer).

## Responsibility

Saved product-id set with persistence. No catalog knowledge.

## Public API

- `ids: Signal<string[]>`, `count`, `has(id)`.
- `add` (idempotent), `remove` (missing-tolerant), `toggle` (returns new
  state), `clear`. All persist to `localStorage: novamart.favorites.v1`
  (deduped strings; corrupt payloads → empty).

## Dependencies

None besides `localStorage`.

## Consumers

Header badge, product-card hearts (`has()`), PDP `isFav`, favorites page,
`PendingActionService.runAction`.

## Tests

Idempotent add, toggle, missing-remove, persistence round-trip.

## Safe extension

Account sync merges server ids into `ids()`; keep `toggle` return semantics.
