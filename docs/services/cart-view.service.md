# CartViewService

- File: `src/app/core/services/cart-view.service.ts`. Spec: `cart-view.service.spec.ts`.
- Root singleton; the **single enrichment point** for cart display.

## Responsibility

Joins authoritative `CartStore` lines with the product catalog into
`EnrichedCartLine` (`product | null`, `unit`, `lineTotal`, `unavailable`).
Created to fix the badge-N/page-empty bug: previously cart and checkout each
joined independently and silently dropped unknown ids.

## Public API

- `lines: Signal<EnrichedCartLine[]>` — one row per stored line, always.
- `pricedSubtotal` — money over available lines only.
- `unavailableCount`; `ready()` / `failed()` (`CartViewStatus`); `refresh()`.

## Dependencies

`CartStore`, `ProductService.all()`.

## Lifecycle, errors, persistence

Loads the catalog snapshot in the constructor (`refresh()`); `ready=false`
renders skeletons, `failed=true` renders error + Retry (`refresh()`).
No persistence of its own.

## Consumers

Cart page (rows, subtotal, states), checkout review + submit items.

## Tests

Agreement (stale ids → unavailable rows, badge math), money exclusion,
loading/ready/error, refresh recovery.

## Safe extension

New display need (e.g. per-line promotions): extend `EnrichedCartLine` here
so every consumer inherits it — never re-join in a page.
