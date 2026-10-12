# Components and Routes

Derived from `src/app/app.routes.ts` and `features/*/*.routes.ts`
(verified; no invented paths).

## Route table

| Route | Component | Guard | Title key | Params / query |
|---|---|---|---|---|
| `/` | `HomePageComponent` | — | `meta.home` | — |
| `/products` | `CatalogPageComponent` | — | `meta.catalog` | `q, category, min, max, avail, sale, sort, page` |
| `/products/:id` | `ProductDetailPageComponent` | — | own title (product name) | `id` (reuses instance) |
| `/cart` | `CartPageComponent` | — | `meta.cart` | — |
| `/favorites` | `FavoritesPageComponent` | `authGuard` | `meta.favorites` | — |
| `/auth/login` | `LoginPageComponent` | — | `meta.login` | `returnUrl?` |
| `/auth/register` | `RegisterPageComponent` | — | `meta.register` | `returnUrl?` |
| `/auth/forgot` | `ForgotPageComponent` | — | `meta.forgot` | — |
| `/auth/profile` | `ProfilePageComponent` | `authGuard` | `meta.profile` | — |
| `/checkout` | `CheckoutPageComponent` | `authGuard` | `meta.checkout` | — |
| `/checkout/confirmation/:id` | `ConfirmationPageComponent` | `authGuard` | `meta.confirmation` | `id` |
| `/orders` | `OrdersPageComponent` | `authGuard` | `meta.orders` | — |
| `/orders/:id` | `OrderDetailPageComponent` | `authGuard` | `meta.orderDetail` | `id` |
| `/not-found` | `NotFoundPageComponent` | — | `meta.notFound` | — |
| `**` | redirect → `/not-found` | — | — | — |
| `/auth` (empty) | redirect → `login` | — | — | — |

`authGuard` stores a typed return intent and redirects to
`/auth/login?returnUrl=<url>`. Layout shell (`MainLayoutComponent` with
header/footer/toast/confirm hosts) wraps every route.

## Navigation flows

```mermaid
flowchart LR
    Home[/] --> Catalog[/products]
    Home --> PDP[/products/:id]
    Catalog --> PDP
    PDP -->|related| PDP
    PDP --> Cart[/cart]
    Catalog --> Cart
    Fav[/favorites] --> Cart
    Cart --> Checkout[/checkout]
    Checkout --> Confirm[/checkout/confirmation/:id]
    Confirm --> Orders[/orders]
    Orders --> Detail[/orders/:id]
    Guest -- gated action/route --> Login[/auth/login]
    Login -- consume intent --> Return[returnUrl + action]
    Header --> Fav & Cart & Orders
```

## Dependency matrix (component → main dependencies → state affected)

| Component | Route/usage | Main dependencies | State affected | Spec |
|---|---|---|---|---|
| App | bootstrap | RouterOutlet | — | ✅ |
| MainLayout | all routes | Header, Footer, Toast, ConfirmDialog | — | — |
| Header | layout | Cart/Favorites/Auth, Product(suggest), Router | lang/currency/session (via owners) | — |
| Footer | layout | Currency, Contact, Router | currency (via owner) | — |
| HomePage | `/` | Product, Cart, Favorites, Notify, Recent, Router | cart, favorites | — |
| CatalogPage | `/products` | Product, Cart, Favorites, Notify, Scroll, Pending, Router | cart, favorites, URL | — |
| ProductDetailPage | `/products/:id` | Product, Cart, Favorites, Notify, Pending, Recent, Scroll | cart, favorites, recent, scroll | ✅ |
| CartPage | `/cart` | CartStore, CartView, Currency, Notify, Confirm | cart | ✅ |
| CheckoutPage | `/checkout` | Cart, CartView, Delivery, Order, Auth, Notify | cart, orders | ✅ |
| ConfirmationPage | `/checkout/confirmation/:id` | Order, Contact, Currency, Scroll | — (reads) | — |
| FavoritesPage | `/favorites` | Product, Cart, Favorites, Notify | cart, favorites | ✅ |
| OrdersPage | `/orders` | Order, Currency | — (reads) | — |
| OrderDetailPage | `/orders/:id` | Order, Currency, Scroll | — (reads) | — |
| Login/Register | `/auth/*` | Auth, Pending, Notify | session, intent | — |
| ForgotPage | `/auth/forgot` | Auth | — | — |
| ProfilePage | `/auth/profile` | Auth | session (logout) | — |
| NotFoundPage | `/not-found`, `**` | RouterLink | — | — |
| ProductCard | grids | Favorites, Money | — (emits) | — |
| EmptyState | states | Button | — (emits) | — |
| SectionHeader | sections | RouterLink | — | — |
| QtySelector | cart, PDP | Button | — (emits) | — |

Mutation rule visible here: only `CartStore`, `FavoritesStore`,
`AuthService`, `OrderService`, `PendingActionService` and `DeliveryService`
(change-free directory) mutate or source state; pages call them.
