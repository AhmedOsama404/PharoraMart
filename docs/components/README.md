# Component Index

Every application component in `src/app`, organized by feature. Each entry
links to a detailed document (identity, routing, behavior, template, methods,
inputs/outputs, dependencies, state, localization, tests, modification guide,
pitfalls). Paths are relative to the repository root.

## Application shell

| Component | Source | Template / Styles | Route / usage | Kind | Spec |
|---|---|---|---|---|---|
| `App` | `src/app/app.ts` | inline (documented exception) | bootstrap root | root | `src/app/app.spec.ts` |
| `MainLayoutComponent` | `src/app/layout/main-layout.component.ts` | [html](../../src/app/layout/main-layout.component.html) / [scss](../../src/app/layout/main-layout.component.scss) | wraps all routes | layout | — |
| `HeaderComponent` | `src/app/layout/header.component.ts` | [html](../../src/app/layout/header.component.html) / [scss](../../src/app/layout/header.component.scss) | embedded in layout | embedded | — |
| `FooterComponent` | `src/app/layout/footer.component.ts` | [html](../../src/app/layout/footer.component.html) / [scss](../../src/app/layout/footer.component.scss) | embedded in layout | embedded | — |

Details: [app](./app.component.md), [main-layout](./main-layout.component.md),
[header](./header.component.md), [footer](./footer.component.md).

## Home and catalog

| Component | Source | Route / usage | Kind | Spec |
|---|---|---|---|---|
| `HomePageComponent` | `src/app/features/home/home-page.component.ts` | `/` | routed | — |
| `CatalogPageComponent` | `src/app/features/products/catalog-page.component.ts` | `/products` + query params | routed | — |
| `ProductDetailPageComponent` | `src/app/features/products/product-detail-page.component.ts` | `/products/:id` | routed (reused) | `product-detail-page.component.spec.ts` |

Details: [home-page](./home-page.component.md),
[catalog-page](./catalog-page.component.md),
[product-detail-page](./product-detail-page.component.md).

## Cart and checkout

| Component | Source | Route / usage | Kind | Spec |
|---|---|---|---|---|
| `CartPageComponent` | `src/app/features/cart/cart-page.component.ts` | `/cart` (public) | routed | `cart-page.component.spec.ts` |
| `CheckoutPageComponent` | `src/app/features/checkout/checkout-page.component.ts` | `/checkout` (guarded) | routed | `checkout-page.component.spec.ts` |
| `ConfirmationPageComponent` | `src/app/features/checkout/confirmation-page.component.ts` | `/checkout/confirmation/:id` (guarded) | routed | — |

Details: [cart-page](./cart-page.component.md),
[checkout-page](./checkout-page.component.md),
[confirmation-page](./confirmation-page.component.md).

## Favorites, orders, authentication

| Component | Source | Route / usage | Kind | Spec |
|---|---|---|---|---|
| `FavoritesPageComponent` | `src/app/features/favorites/favorites-page.component.ts` | `/favorites` (guarded) | routed | `favorites-page.component.spec.ts` |
| `OrdersPageComponent` | `src/app/features/orders/orders-page.component.ts` | `/orders` (guarded) | routed | — |
| `OrderDetailPageComponent` | `src/app/features/orders/order-detail-page.component.ts` | `/orders/:id` (guarded) | routed | — |
| `LoginPageComponent` | `src/app/features/auth/login-page.component.ts` | `/auth/login` | routed | — |
| `RegisterPageComponent` | `src/app/features/auth/register-page.component.ts` | `/auth/register` | routed | — |
| `ForgotPageComponent` | `src/app/features/auth/forgot-page.component.ts` | `/auth/forgot` | routed | — |
| `ProfilePageComponent` | `src/app/features/auth/profile-page.component.ts` | `/auth/profile` (guarded) | routed | — |
| `NotFoundPageComponent` | `src/app/features/static/not-found-page.component.ts` | `/not-found`, `**` | routed | — |

Details: [favorites-page](./favorites-page.component.md),
[orders-page](./orders-page.component.md),
[order-detail-page](./order-detail-page.component.md),
[login-page](./login-page.component.md),
[register-page](./register-page.component.md),
[forgot-page](./forgot-page.component.md),
[profile-page](./profile-page.component.md),
[not-found-page](./not-found-page.component.md).

## Shared UI components

| Component | Source | Rendered in | Kind | Spec |
|---|---|---|---|---|
| `ProductCardComponent` | `src/app/shared/components/product-card.component.ts` | home, catalog, PDP related, favorites | shared | — |
| `EmptyStateComponent` | `src/app/shared/components/empty-state.component.ts` | all pages (loading/error/empty) | shared | — |
| `SectionHeaderComponent` | `src/app/shared/components/section-header.component.ts` | home, PDP | shared | — |
| `QtySelectorComponent` | `src/app/shared/components/qty-selector.component.ts` | cart, PDP | shared | — |

Details: [product-card](./product-card.component.md),
[empty-state](./empty-state.component.md),
[section-header](./section-header.component.md),
[qty-selector](./qty-selector.component.md).

Total: **22 components documented** (21 external-file components + the root
`App` shell), verified against `src/app/**/*.component.ts`.
