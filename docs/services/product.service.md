# ProductService (mock catalog)

- File: `src/app/core/services/product.service.ts`. Specs:
  `product-categories.spec.ts` (+ `catalog.utils.spec.ts` for query logic).
- Root singleton; single data-access boundary for products/categories.

## Responsibility

Mock catalog over in-memory signals (`MOCK_PRODUCTS`, `MOCK_CATEGORIES`)
with simulated latency. Components never call HTTP.

## Public API

- `list(query)` — filter/sort/paginate (`catalog.utils`), `{items,total}`;
  honors `forceError` (error-state demo) and `useMockApi`.
- `all()` — synchronous full snapshot for cart/favorites/checkout joins
  (**mock-only seam**; real API resolves line items server-side).
- `getById(id)` — `not-found` error for unknown ids.
- `categories()` — **active** categories in `sortOrder`; `categoryById()`.
- `categoryName(id)` / `categoryDescription(cat)` — localized with English
  fallback, id fallback for unknown ids (removed categories keep rendering).
- `related()`, `featured()`, `newArrivals()`, `popular()`, `onSale()`,
  `suggestions(term)`.

## Dependencies

Mock data, `catalog.utils`, `pickLocaleText`, `I18nService` (names),
`environment` (mock switch).

## Consumers

Home, catalog, PDP, cart/checkout (via view), favorites, header search.

## Tests

Category order/activity/localization/fallback; query logic in
`catalog.utils.spec.ts`.

## Safe extension

Replace mock branches with `ApiClientService` calls (same signatures);
`all()` disappears against a real backend.
