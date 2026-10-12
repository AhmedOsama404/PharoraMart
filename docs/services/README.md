# Service Index

Root-provided singletons in `src/app/core/services/` (+ `core/api/`,
`core/guards/`). Exactly one instance each — cart/badge/checkout agreement
depends on never re-providing them.

| Service / store | File | Detailed doc |
|---|---|---|
| `CartStore` (raw cart state) | `core/services/cart.store.ts` | [cart.store](./cart.store.md) |
| `CartViewService` (enriched rows) | `core/services/cart-view.service.ts` | [cart-view](./cart-view.service.md) |
| `FavoritesStore` | `core/services/favorites.store.ts` | [favorites.store](./favorites.store.md) |
| `AuthService` (mock session) | `core/services/auth.service.ts` | [auth](./auth.service.md) |
| `PendingActionService` (intents) | `core/services/pending-action.service.ts` | [pending-action](./pending-action.service.md) |
| `ProductService` (mock catalog) | `core/services/product.service.ts` | [product](./product.service.md) |
| `DeliveryService` (hotels/quotes) | `core/services/delivery.service.ts` | [delivery](./delivery.service.md) |
| `OrderService` (mock orders) | `core/services/order.service.ts` | [order](./order.service.md) |
| `I18nService` | `core/services/i18n.service.ts` | [i18n](./i18n.service.md) |
| `CurrencyService` | `core/services/currency.service.ts` | [currency](./currency.service.md) |
| `NotificationService` | `core/services/notification.service.ts` | [notification](./notification.service.md) |
| `ContactService` | `core/services/contact.service.ts` | [contact](./contact.service.md) |
| `ApiClientService` | `core/api/api-client.service.ts` | [api-client](./api-client.service.md) |
| `ScrollService` | `core/services/scroll.service.ts` | [scroll](./scroll.service.md) |
| `LocalizedTitleStrategy` | `core/services/title.strategy.ts` | [title](./title.strategy.md) |

## Smaller utilities (documented here)

- **`RecentlyViewedService`** (`core/services/recently-viewed.service.ts`):
  capped (8) product-id list in `localStorage: novamart.recently-viewed.v1`;
  `push()` (dedupes, front-inserts), `list()`. Written by PDP, read by home.
- **`authGuard`** (`core/guards/auth.guard.ts`): functional guard; signed-in
  passes, guests get a reasoned return intent + explanation toast + redirect
  to `/auth/login?returnUrl=`. Reason mapping: `/favorites` →
  `addToFavorites`, `/checkout` → `checkout`, else `account`. Spec covers
  redirect + intent + passthrough.
- **`apiInterceptor`** (`core/api/api.interceptor.ts`): attaches
  `Authorization: Bearer` from the mock session when present; maps HTTP
  errors to localized toasts centrally.
- **`catalog.utils.ts`** (`data-access/`): pure `filterProducts`,
  `sortProducts`, `paginateProducts`, `queryProducts` — the entire catalog
  logic, fully unit-tested, no Angular dependencies.
- **`validators.ts`** (`shared/utils/`): `phoneValidator`,
  `passwordMatchValidator`, `firstErrorKey()` (control errors →
  `validation.*` keys). Spec-covered.
- **`localized.utils.ts`**: `pickLocaleText()` (dashboard content with
  English fallback). Spec-covered.
- **`order-status.utils.ts`**: `orderStatusLabel/Severity` shared by both
  order pages. Spec-covered.
- **`MoneyPipe`** (`shared/pipes/money.pipe.ts`): impure pipe formatting via
  `CurrencyService` (impurity required: re-formats every CD using cached
  `Intl` instances).

Total: **15 dedicated service documents** + utilities above.
