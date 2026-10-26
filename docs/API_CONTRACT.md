# PharoraMart API Integration Contract (Frontend → Future Backend)

> **Historical design contract (not authoritative).** The app now runs against
> the live ASP.NET Core API (`useMockApi: false`). For the current endpoint
> inventory, auth flow, trust boundaries and known mismatches, see
> `D:\_prod_readiness\INTEGRATION-MAP.md` and the generated OpenAPI snapshot
> `D:\_prod_readiness\baselines\swagger.json`. Keep this document only for
> historical intent; do not use it as an integration source of truth.
>
> The original text below was written when the storefront ran in mock mode.

## 0. Conventions

- Base URL: `environment.apiBaseUrl` (e.g. `https://api.example.com/api/v1`).
- All calls go through `src/app/core/api/api-client.service.ts`
  (`ApiClientService.get/post/put/delete`). **Components must never use
  `HttpClient` directly and must never hardcode URLs.**
- Auth: `Authorization: Bearer <token>` added by
  `src/app/core/api/api.interceptor.ts` when a session exists.
- Errors: HTTP error responses are mapped centrally by the interceptor to a
  localized toast (`notifications.loadFailed`). Feature services map
  status-specific cases (401/404/409) where the UX needs it.
- Envelopes: services accept either `{ data }` or raw payloads; backend may
  return plain JSON arrays/objects (preferred) — see shapes below.
- Error convention (proposed, ASP.NET Core friendly): RFC 7807
  `ProblemDetails` (`{ type, title, status, detail, errors? }`) with
  `errors: { field: [message] }` for validation failures (422). The
  interceptor maps these to localized toasts; 401 triggers re-login.
- Versioning: version in the URL (`/api/v1/...`, from `apiBaseUrl`) so the
  storefront can move endpoints independently. DTOs use camelCase JSON
  (ASP.NET Core default) matching the TypeScript models 1:1; enums travel as
  strings (`pending`, `cash_on_delivery`, …), never ints.
- C# mapping sketch: `record ProductDto(string Id, string Sku, …, decimal
  Price, decimal? SalePrice, …)`; `decimal` for all money; `DateTimeOffset`
  (UTC, ISO-8601) for timestamps; `IReadOnlyList<T>` for collections.

## 1. Products & Categories

| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/products` | `q, categoryId, minPrice, maxPrice, availability, onSale, tags, sort, page, pageSize` | `{ items: Product[], total: number }` |
| GET | `/products/:id` | — | `Product` |
| GET | `/products/featured` | — | `Product[]` |
| GET | `/products/new` | — | `Product[]` |
| GET | `/products/popular` | — | `Product[]` |
| GET | `/products/price-range` | — | `{ minPrice: number, maxPrice: number, currency: "USD" }` |
| GET | `/products/suggest?q=` | `q, limit` | `Product[]` (id, name, image) |
| GET | `/categories` | — | `Category[]` |
| GET | `/products/:id/related` | `limit` | `Product[]` |

`Product` shape — see `src/app/models/product.model.ts`:
`{ id, sku, name, description, categoryId, price, salePrice?, images[],
rating, reviewsCount, soldCount, stock, isNew, isFeatured, isPopular,
tags[], attributes[{name,value}], variants?[{id,name,options[]}], createdAt }`.
Prices are in the store base currency (USD in mock mode).

`sort` values: `recommended | newest | price_asc | price_desc | name_asc | bestselling`.

`GET /products/price-range` returns the price range of the **active**
catalogue in USD (the store's price-filter contract currency), using the
effective price (sale price when set). The catalog's price filter needs the
real ceiling: a number bundled with the frontend would make a product priced
above it impossible to filter. The storefront falls back to its bundled demo
ceiling when this endpoint is unavailable, so an older backend still works.

`Category` shape — see `src/app/models/product.model.ts` (dashboard-managed):
`{ id, name, names{en,ar?,cs?,…}, description, descriptions?, image,
sortOrder, isActive, productCount? }`. Stable `id` is the permanent key —
localized display names are never identifiers. `GET /categories` returns
active categories in `sortOrder`; inactive ones are hidden from navigation and
filters while their products keep rendering with an id fallback.

Note: `ProductService.all()` (full in-memory snapshot used by the cart,
favorites and checkout pages to join local state) is a mock-mode-only seam —
a real backend resolves line items server-side, so it has no endpoint.

## 2. Cart (account-required, mock-local today)

Browsing is public, but adding to the cart requires sign-in: the storefront
holds the attempt as a typed return intent (`PendingActionService`) and
completes it once after authentication. Local state today (`CartStore`,
`localStorage: novamart.cart.v1`). When the backend is ready, sync with
(per-account, `Authorization` required):

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/cart` | — | `{ lines: [{ productId, variantKey?, qty }] }` |
| PUT | `/cart` | `{ lines: [...] }` (idempotent full replace) | `{ lines: [...] }` |

Merge rule: same `productId + variantKey` = one line, quantities summed and
clamped to stock. Totals are always **derived** from lines, never stored.

## 3. Favorites (account-required, mock-local today)

Saving favorites requires sign-in (same return-intent flow as the cart).
Local state today (`FavoritesStore`, `localStorage: novamart.favorites.v1`).
Per-account endpoints later (`Authorization` required):

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/favorites` | — | `{ productIds: string[] }` |
| POST | `/favorites` | `{ productId }` (idempotent) | `{ productIds: string[] }` |
| DELETE | `/favorites/:productId` | — | `{ productIds: string[] }` |

## 4. Auth (mock today — NOT real/secure)

Mock `AuthService` stores users in `localStorage: novamart.mock-users.v1` and a
session in `novamart.session.v1`. Real backend contract:

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | `{ user: User, token: string }` (401 on bad credentials) |
| POST | `/auth/register` | `{ name, email, password, phone? }` | `{ user: User, token: string }` (409 email taken) |
| POST | `/auth/forgot-password` | `{ email }` | `{ ok: true }` (always 200, no account disclosure) |
| GET | `/auth/me` | — | `User` (401 when logged out) |

`User = { id, name, email, phone? }`.

## 5. Orders (mock today — cash on delivery only)

Mock `OrderService` persists to `localStorage: novamart.orders.v1`.
Payment is **cash_on_delivery only** — no cards, gateways or wallets.

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/orders` | `CreateOrderRequest + Idempotency-Key header` | `Order` (201) |
| GET | `/orders` | `page, pageSize` | `{ items: Order[], total: number }` |
| GET | `/orders/:id` | — | `Order` (404 unknown) |

`CreateOrderRequest = { customer{ fullName, phone, email?, city, hotelId,
hotelName, room?, notes?, contactMethod }, items[{ productId, productName,
image, unitPrice, qty, variantLabel? }], subtotal, deliveryFee, total,
currency, paymentMethod: 'cash_on_delivery' }`.

`Order = CreateOrderRequest + { id, orderNumber, status, createdAt, userId? }`,
`status ∈ pending | confirmed | shipped | delivered | cancelled`.

**Idempotency:** the checkout page generates one key per attempt and disables
the submit button while placing; the backend MUST also dedupe on
`Idempotency-Key` so retries/double-clicks never create two orders.

**Server-authoritative totals:** the frontend displays the quoted delivery fee
but the backend MUST recompute subtotal, fee and total from live prices before
persisting — never trust client-sent money.

## 5b. Hotels & Delivery quotation (mock directory today)

Sample directory in `DeliveryService` (`HOTELS`, Marsa Alam + Hurghada).
Dashboard-managed later; same shape over HTTP:

| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/hotels` | `city?, q?` | `Hotel[]` (active, `sortOrder`) |
| GET | `/hotels/:id` | — | `Hotel` (404 unknown/inactive) |
| POST | `/delivery/quote` | — | `{ hotelId, fee, currency }` |

`Hotel = { id, name, names?, city, area?, isActive, sortOrder, zoneId,
deliveryFee, notes?, coordinates? }`. Stable `id` is permanent; names are
display-only. `POST /delivery/quote` body `{ hotelId, subtotal, currency }` —
the returned `fee` is what the checkout displays and the order stores.
Future rules (per-zone fees, distance pricing, minimums, restrictions) plug in
behind this endpoint; the storefront needs no changes (`DeliveryService` is
the only caller). Distance math, if ever needed, stays server-side — no paid
maps/geocoding in the frontend.

## 6. Notifications (future push/email providers)

UI feedback today uses PrimeNG Toast/ConfirmDialog via
`NotificationService` (`src/app/core/services/notification.service.ts`).
Real delivery contract (backend-owned, secrets stay server-side):

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/notifications/whatsapp` | `{ to, templateId, params, orderId? }` | Provider (e.g. WhatsApp Business API) called server-side |
| POST | `/notifications/email` | `{ to, subject, body, orderId? }` | Sent server-side (SMTP/API) |

The frontend `ContactService` only **prepares** messages and opens
`https://wa.me/<number>?text=<encoded>` or `mailto:` links. It never claims
delivery — toasts/labels say the external app was *opened*.

## 7. Store configuration & homepage content (dashboard-managed later)

Public, unauthenticated reads the storefront needs once the dashboard exists:

| Method | Path | Response |
|---|---|---|
| GET | `/store/settings` | `{ whatsappNumber, supportEmail, businessHours, contactMode, defaultCurrency }` |
| GET | `/store/homepage` | `{ heroProductIds[], featuredCategoryIds[], promoCategoryId?, perks[] }` |

Today the storefront reads `/store/settings` once per session (`ContactService`);
the contact/mode/hours in `src/environments/environment*.ts` stay the fallback
until (and unless) the API answers. `/store/homepage` still lives in
in-component queries (`featured()`, `popular()`); the shapes above let the
dashboard take over without touching components.

## 8. Switching mock → real API

1. Set `useMockApi: false` and the real `apiBaseUrl` in
   `src/environments/environment*.ts`.
2. Implement the `*Service` HTTP methods via `ApiClientService`
   (replace the `of(...).pipe(delay(...))` mock branches).
3. Keep method signatures, models and component code unchanged.

## 9. Contract alignment (Phase 8)

The API is the authority for every rule below; the storefront sends what the
API declares and nothing more.

### Coupon validation carries the basket

`POST /api/v1/coupons/validate` now applies the SAME scope rule as order
placement. The request therefore carries the basket:

```json
{ "code": "SAVE10", "subtotal": 20, "productIds": ["karkadeh"] }
```

* `productIds` is the list of product ids in the basket.
* A **product- or category-scoped coupon** is refused with
  `coupon_not_applicable` when the basket does not match — exactly as
  order placement refuses it. Before this the validation answered "valid"
  and the order was rejected at submit, so the customer saw the coupon
  applied and the checkout failed.
* The request identity includes the basket, so swapping one product for
  another of the same price re-validates the coupon.

### The order request

| Field | Rule |
|---|---|
| `customer.contactMethod` | exactly `whatsapp` or `email` — the API's allow-list. The client type mirrors it, so a value the API would reject cannot be typed. |
| `items[].image` | a **required string**: a product without a picture sends `""`, never `undefined` (which is a 400). |
| `consentTextHash` | a SHA-256 hex (64 chars) of the consent line the customer saw, sent only when the customer opted in to WhatsApp. The server stores it with the consent record, so "what was agreed" stays provable. |

### Password reset is a real request

`POST /api/v1/auth/forgot-password` is now called (it answers 200 for every
well-formed address, so no account is disclosed). The API's reset *delivery*
is still a stub — it validates and answers, but no email leaves the server
yet — so the screen keeps saying so.

### The store's default currency

`GET /api/v1/store/settings` publishes `defaultCurrency`. The storefront
reads it and applies it as the currency a NEW visitor sees; a visitor who
already chose a currency keeps their own choice (it is remembered).

### DTO fields the client now keeps

* `HotelDto.cityId` — the stable city id (the name above is a display
  value).
* `DeliveryQuoteDto.exchangeRateSource` — the FX provenance of a converted
  fee.
