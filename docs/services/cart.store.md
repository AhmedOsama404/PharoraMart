# CartStore

- File: `src/app/core/services/cart.store.ts`. Spec: `cart.store.spec.ts`.
- Root singleton; the **authoritative raw cart state**.

## Responsibility

Owns cart lines and nothing else. Identity, merging, clamping, persistence.

## Public API

- `lines: Signal<CartLine[]>` — raw lines `{key, productId, variantKey?,
  variantLabel?, qty}` (key = `cartLineKey()`).
- `count` — Σ qty over all lines (badge convention, binding rule).
- `isEmpty`; `qtyOf(productId, variantKey?)`.
- `add(productId, qty, variantKey?, variantLabel?, maxStock?)` — merges into
  the existing key or appends; clamps to `[1, maxStock]`; returns final qty;
  persists.
- `setQty(key, qty, maxStock)` (clamped), `remove(key)`, `clear()` — all
  persist synchronously after updating (hydration can never overwrite them).

## Dependencies

None (pure + `localStorage`). Deliberately unaware of the catalog — display
joins live one layer up (`CartViewService`).

## Lifecycle, errors, persistence

- `load()` runs once at construction: validates item-by-item (bad entries
  skipped), clamps qty to `[1, 99]`, rebuilds keys. Corrupt JSON → empty cart,
  never a crash.
- `persist()` strips derived fields and writes plain `CartItem[]` to
  `novamart.cart.v1` (try/catch — private-mode failures degrade silently).

## Consumers

Header badge (`count()`), cart/checkout pages (via `CartViewService`),
favorites/PDP/home/catalog `add` calls, `PendingActionService.runAction`,
checkout submit + clear.

## Tests

Add/merge/variants/clamp/update/remove/clear/persistence/restore
(`cart.store.spec.ts`).

## Safe extension

Server sync merges into `lines()` (same shapes); keep `add()` the single
mutation entry — no parallel line builders.
