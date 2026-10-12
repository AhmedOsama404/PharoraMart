# ApiClientService

- File: `src/app/core/api/api-client.service.ts`. No spec (thin wrapper today).
- Root singleton; the **only** HTTP touchpoint for the future backend.

## Responsibility

Base-URL joining (`environment.apiBaseUrl`), typed `get/post/put/delete`.
Currently unused in mock mode (`useMockApi: true`) — kept ready so services
swap mock branches for HTTP calls without touching components.

## Consumers (future)

`ProductService`, `DeliveryService`, `OrderService`, `AuthService` (account
cart/favorites sync), store settings.

## Safe extension

Implement one service method at a time via this client; keep signatures;
map `ProblemDetails` per API_CONTRACT conventions. Components must never
import `HttpClient` directly (review-enforced).
