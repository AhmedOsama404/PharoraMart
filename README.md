# Pharora — Cosmetics & Herbs for Marsa Alam and Hurghada (Angular 20 + PrimeNG)

**New here? Start with [`docs/LEARNING_PATH.md`](./docs/LEARNING_PATH.md)** —
a step-by-step course for developers new to this codebase (no Angular
experience assumed) — then work the hands-on [`docs/TUTORIALS.md`](./docs/TUTORIALS.md).

Professional storefront for international hotel guests in Marsa Alam and
Hurghada, Egypt: natural **cosmetics** and **herbs** with hotel-specific
delivery, account-based shopping, cash on delivery, and WhatsApp/email order
communication — in **8 languages (EN, AR with full RTL, CS, DE, FR, IT, PL, SK)**.

Guest browsing is public; cart, favorites, checkout and account pages require
sign-in with a typed return-intent flow (the intended click completes once
after authentication). Mock mode is the development default; live API mode
(`useMockApi:false`) calls the real ASP.NET Core backend — see
`docs/LIVE_API_CUTOVER.md`. A production build refuses to boot in mock mode.

## Stack

- Angular **20.3**, TypeScript strict, standalone components, lazy-loaded routes
- PrimeNG **20.3** (`@primeng/themes` Aura preset), PrimeIcons 7
- SCSS design tokens, signals + RxJS, Reactive Forms, HttpClient (centralized)
- OnPush change detection on all components, memoized option lists, cached
  `Intl` formatters, cancellation-aware (`switchMap`) route data loading
- Centralized `ScrollService` (router scroll restoration intentionally off:
  catalog query-param navigations must not yank the viewport)
- Karma/Jasmine unit tests (147 specs, ChromeHeadless)

## Quick start

```bash
npm install
npm start            # dev server → http://localhost:4200
npm run build        # production build → dist/storefront
npm test             # unit tests, single run (needs Chrome; uses CHROME_BIN if set)
```

Windows (PowerShell):

```powershell
npm install
npm start
$env:CHROME_BIN='C:\Program Files\Google\Chrome\Application\chrome.exe'
npm test
```

## Configuration (`src/environments/environment*.ts`)

| Key | Default | Meaning |
|---|---|---|
| `apiBaseUrl` | `https://api.example.com/api/v1` | Future backend base URL (unused in mock mode) |
| `useMockApi` | `true` | `true` = local mock data; `false` = call real API via `ApiClientService` |
| `defaultLang` / `defaultCurrency` | `en` / `USD` | Initial language & currency |
| `supportEmail` | `support@pharora.example.com` | Email contact (`mailto:`) |
| `whatsappNumber` | `201001234567` | WhatsApp click-to-chat number (no `+`) |
| `contactMode` | `both` | `whatsapp` \| `email` \| `both` contact buttons |
| `freeShippingThreshold` | `75` | Free shipping above this subtotal |
| `pageSize` | `12` | Catalog page size |

No secrets or credentials are stored in frontend code. Guest language, currency,
cart, favorites, session and orders persist in `localStorage` (`novamart.*` keys).

## Project structure

```text
src/app/
  core/         config, api/ (ApiClientService, interceptor), guards, services/
                services/title.strategy.ts (localized document titles)
  models/       api, product, cart, user, order contracts
  data-access/  mock-data, catalog.utils (pure filter/sort/paginate + specs)
  i18n/         en/ar/cs/it/pl/fr/sk/de.ts (identical keys; enforced by test)
  shared/       components/, pipes/ (money), utils/ (validators, order-status)
  layout/       header, footer, main-layout (toast + confirm dialog host)
  features/     home, products, cart, favorites, auth, checkout, orders, static
  environments/ (at src/environments)
docs/API_CONTRACT.md   endpoints & payloads the future backend must implement
```

Full developer documentation lives under `docs/` — start at
[docs/README.md](./docs/README.md).

Every component uses separate `.ts` / `.html` / `.scss` files (`templateUrl` /
`styleUrl`). The only intentional exception is the root `App` shell
(`<router-outlet />`, documented in `app.ts`).

Rules: components never call HTTP or hardcode URLs; all data flows through
feature services (`ProductService`, `CartStore`, `FavoritesStore`,
`AuthService`, `OrderService`, `ContactService`, `CurrencyService`,
`I18nService`, `NotificationService`). Inputs bound to PrimeNG components must
be referentially stable (memoized `computed` / cached arrays) — rebuilding
option objects per change-detection cycle can trap `RouterLinkActive` in an
infinite render loop (this froze the product page once; see
`product-detail-page.component.ts` and its regression spec).

## Features & acceptance checklist

- [x] App starts (`npm start`), polished responsive UI (mobile/tablet/desktop)
- [x] 8-language runtime switching (EN/AR/CS/IT/PL/FR/SK/DE), persisted, no reload;
      AR = full RTL, rest LTR (`lang`+`dir` on `<html>`); localized document titles
- [x] Search (+suggestions), sort (6 modes), filters (category/price/availability/sale), pagination, query-param state, loading/empty/error states
- [x] Product details with explicit loading/ready/not-found/error states,
      request cancellation on rapid navigation, scroll-to-top on product change, working retry (regression-tested)
- [x] Cosmetics + herbs as data-driven categories (localized names, dashboard-ready contract)
- [x] Guest browsing public; cart/favorites/checkout/account require sign-in with
      typed return intents (pending click completes once after auth, safe URLs only)
- [x] Hotel directory (Marsa Alam + Hurghada samples) with city filter, hotel
      search, per-hotel quoted fees; checkout blocks on unknown/failed quotes
- [x] Cart (signed-in; stock-clamped, no duplicate lines, derived totals, clear-with-confirm)
- [x] Favorites (signed-in; counts, move-to-cart)
- [x] Guest shopping end-to-end without login; mock login/register/profile/forgot + return-URL
- [x] Cash-on-delivery checkout (validated Reactive Form incl. hotel + room,
      double-submit guard, idempotency key), confirmation page with hotel summary
- [x] WhatsApp `wa.me` pre-filled message (reference, items, subtotal, fee, total,
      hotel, contact) + `mailto:` (both honestly labeled “opens app, sends nothing”)
- [x] Order history + details (mock), empty states, localized toasts/validation
- [x] `npm test` → 128/128 SUCCESS; `npm run build` (production) passes
- [x] `docs/HOSTING.md` checklist (SPA fallback, HTTPS, compression, cache headers, SEO limits)

## Known limitations (by design, frontend-only phase)

- No real backend: products, auth, orders and “sent” messages are **local mocks**
  (clearly labeled in UI + footer). No real payment, email or WhatsApp delivery.
- Mock auth is **not secure** (localStorage demo session).
- Product images use Unsplash CDN URLs with a `picsum.photos` fallback.
- Currency rates are static config, converted from USD base prices for display.
