# Live API cutover (2026-10-13)

The storefront runs in two modes from `src/environments/*` (`useMockApi`).

## Modes

|  | Mock (`useMockApi:true`, dev default) | Live (`useMockApi:false`) |
|---|---|---|
| Products/categories | `mock-data.ts` + simulated latency | `GET /products…`, `/categories`, `/products/:id`, related/showcase/suggest |
| Auth | localStorage users, `mock.*` tokens | `POST /auth/login|register`, `GET /auth/me` (JWT) |
| Cart/favorites | browser-local only | Browser-local UI state + server sync (`PUT /cart`, `GET|POST /favorites`, pull on sign-in via `AccountSyncService`) |
| Checkout quote | sample hotel fees | `POST /delivery/quote` (authoritative fee) |
| Coupons | rejected with message | `POST /coupons/validate` + `couponCode` in `POST /orders` |
| Orders | localStorage list | `POST /orders` (server recomputes money/stock/coupon, decrements inventory), `GET /orders`, `GET /orders/:id` |
| CMS | static homepage only | `GET /content` published blocks render below the promo banner |
| Inactive products | N/A | Hidden from listing/detail/related/showcase/suggest; unresolvable cart lines render as explicit unavailable rows |

## Trying live mode locally

1. Start the API (`D:\NovaBackend`, Development seeds + `admin@pharora.local`).
2. Register a customer in the storefront (or log in).
3. Set `useMockApi:false` in `src/environments/environment.development.ts`
   (`apiBaseUrl` already points at `http://localhost:5086/api/v1`) and restart `ng serve`.
4. Browse → add to cart → checkout with a hotel → place a COD order →
   confirm it appears under Orders and in the dashboard.

## Production safety

- `src/main.ts` throws at bootstrap when `production && useMockApi` — a prod
  build can never silently serve fake data or fake checkout success.
- `environment.ts` (prod) keeps `useMockApi:false`; set its `apiBaseUrl` to the
  real public API origin at deploy time (never localhost, never a placeholder).
- `environment.guard.spec.ts` enforces: prod ⇒ no mock, https, no localhost;
  live mode ⇒ real URL shape (no `api.example.com` placeholder).

## What live mode does NOT do

- No payment provider (COD only, contract-wide).
- No offline queue: failed sync pushes are dropped (local state stays); the
  next pull or mutation retries. Orders are never placed without a response.
- Favorites removal syncs on next pull; additions push best-effort.
- Currency display stays client-side; the server normalizes order currency.
