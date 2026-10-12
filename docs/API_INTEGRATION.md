# API Integration (storefront → future backend)

How to connect a real backend **without rewriting the storefront**.
Endpoint-by-endpoint reference: [API Contract](./API_CONTRACT.md).
Scope: storefront integration only — no dashboard/backend implementation here.

## What is mocked vs implemented today

| Area | Today | Later |
|---|---|---|
| Products/categories | `ProductService` mock signals | `GET /products…`, `GET /categories` |
| Hotels/quotes | `DeliveryService` sample list/fees | `GET /hotels…`, `POST /delivery/quote` (authoritative) |
| Cart/favorites | `CartStore`/`FavoritesStore` + localStorage | account-scoped `GET/PUT /cart`, `/favorites` |
| Auth/session | `AuthService` localStorage demo (**not secure**) | `POST /auth/*`, Bearer tokens |
| Orders | `OrderService` localStorage + idempotency keys | `POST /orders` (server validates + recomputes) |
| Contact | `wa.me`/`mailto:` links (open apps, send nothing) | server-side WhatsApp/email providers |
| Settings/homepage | `environment.*` + in-component queries | `GET /store/settings`, `/store/homepage` |

## Base URL and environments

`environment.apiBaseUrl` (+ `useMockApi` switch). Dev serves
`environment.development.ts` via `fileReplacements`; prod builds use
`environment.ts`. API version lives in the URL (`/api/v1`).

## Typed contracts and HTTP services

- Models in `src/app/models/` are the DTOs (camelCase, string enums, `number`
  money in mock; backend uses `decimal`, UTC ISO-8601, `ProblemDetails` —
  see contract conventions).
- All HTTP goes through `ApiClientService.get/post/put/delete`; components
  never touch `HttpClient`. `apiInterceptor` attaches
  `Authorization: Bearer` from the session and maps failures to localized
  toasts (401 → re-login path).

## Per-area transition notes

- **Products/categories**: replace mock branches with `ApiClientService`
  calls; keep signatures. `all()` is mock-only (server resolves line items).
- **Cart/favorites**: merge server state into `lines()`/`ids()`; totals,
  badge, and views follow automatically. Keep the identity rule
  (`productId + variantKey`) and clamping client-side too.
- **Hotels/quotes**: `quoteFor()` becomes `POST /delivery/quote`; checkout
  already treats the quote as the only fee writer and blocks on failure.
- **Orders**: send the idempotency key header; backend dedupes, validates
  auth/stock/prices/fees, recomputes totals — never trust client money.
- **Auth**: swap session handling for tokens; keep `PendingActionService`
  flow unchanged (it is transport-agnostic).
- **Pagination/filtering**: pass `CatalogQuery` through; render `items/total`.
- **Loading/empty/error**: keep terminal states; use `switchMap` cancellation
  for route-driven loads; retry via the existing `refresh()`/`retry()` hooks.

## Mock-to-real checklist per service

1. Implement the method via `ApiClientService` (same signature).
2. Map `ProblemDetails` field errors to form/server messages.
3. Flip `useMockApi: false` for that service (or globally).
4. Run `npm test` + the [release checklist](./TESTING.md); verify EN + AR.
