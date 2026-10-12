# Project Structure

```text
D:\Default Project
├── src/
│   ├── main.ts                      # bootstrap (App + appConfig)
│   ├── index.html                   # shell, meta/OG tags, base href
│   ├── styles.scss                  # design tokens, PrimeNG polish, RTL helpers
│   ├── environments/
│   │   ├── environment.ts           # production build (production: true)
│   │   └── environment.development.ts # ng serve via fileReplacements
│   └── app/
│       ├── app.ts / .routes.ts / .config.ts / .spec.ts
│       ├── core/
│       │   ├── api/                 # ApiClientService, apiInterceptor (HTTP only here)
│       │   ├── config/              # i18n.config (langs, locales, dirs)
│       │   ├── guards/              # authGuard (+spec)
│       │   └── services/            # state + domain services (each +spec mostly)
│       ├── data-access/             # mock-data.ts, catalog.utils.ts (+specs)
│       ├── features/{home,products,cart,favorites,auth,checkout,orders,static}/
│       │                            # pages (.ts/.html/.scss), routes, specs
│       ├── i18n/                    # en/ar/cs/de/fr/it/pl/sk.ts (identical keys)
│       ├── layout/                  # header, footer, main-layout
│       ├── models/                  # api/cart/hotel/order/product/user contracts
│       └── shared/
│           ├── components/          # product-card, empty-state, section-header, qty-selector
│           ├── pipes/               # money.pipe
│           └── utils/               # validators, localized, order-status (+specs)
├── docs/                            # this documentation system
├── public/                          # favicon.svg (served as-is)
├── angular.json / package.json / tsconfig.*.json
└── novamart-storefront-src.zip      # packaged source snapshot
```

## Where code belongs

- **New page/route** → `features/<journey>/`: component trio + `*.routes.ts`
  entry (+ lazy `loadComponent`/`loadChildren`). Never put pages in `shared/`.
- **Reusable UI** → `shared/components/` (dumb, `@Input`/`@Output` only).
  Business rules go to services, not shared components.
- **State or HTTP** → `core/services/` (state) or `core/api/` (HTTP).
  Components must not call `HttpClient` or hardcode URLs — verified by review.
- **Types** → `models/` (stable ids, optional fields for dashboard growth).
- **Translations** → `i18n/<lang>.ts`, identical keys everywhere
  (enforced by the key-consistency test). Never hardcode UI strings.
- **Mock data** → `data-access/mock-data.ts` and service-local `HOTELS`-style
  constants only. Components must not import mock data.

## Files changed together (typical)

- New checkout field: `order.model.ts` → checkout `.ts/.html` → `en..sk.ts`
  (key parity!) → `order.service.spec` / checkout spec → `API_CONTRACT.md`.
- New language: `i18n/<code>.ts` (full copy) → `i18n.config.ts`
  (`SupportedLang`, `SUPPORTED_LANGS`, `LANG_LOCALES`, `LANG_DIRS`) →
  run the key-consistency test.
- New cart rule: `cart.store.ts` or `cart-view.service.ts` → specs →
  [Cart and Checkout](./CART_AND_CHECKOUT.md) troubleshooting if behavior changes.
- New API endpoint (future): `ApiClientService` usage in the owning service →
  `docs/API_CONTRACT.md` + [API Integration](./API_INTEGRATION.md).
