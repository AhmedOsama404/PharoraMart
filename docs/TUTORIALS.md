# Storefront Tutorials — Learn by Doing

Hands-on lessons using **this** repository. Run commands from
`D:\Default Project`. Node v22 + npm 10 expected (`node --version`).

## Tutorial 0: Setup and what can run here

**What:** verify your machine runs everything testable.
**How:**

1. `npm install` (creates `node_modules/`; never commit it).
2. `npm start` → `http://localhost:4200` shows the shop (mock mode default).
3. `npm test` → 147 specs pass in headless Chrome
   (needs Chrome; set `$env:CHROME_BIN='C:\Program Files\Google\Chrome\Application\chrome.exe'`
   in PowerShell if the runner cannot find it).
4. `npm run build` → production bundle in `dist/`.
5. Anything calling the **real backend** (`useMockApi:false`) needs the API
   running at `http://localhost:5086` — see
   [`LIVE_API_CUTOVER.md`](./LIVE_API_CUTOVER.md). Those steps are tagged
   **(needs API)**; everything else is **[runs anywhere]**.

## Tutorial 1: Tour the app from bootstrap to pixels (25 min)

**What:** see how Angular assembles the shop.
**Why:** every bug lives somewhere on this path.
**How:**

1. Open `src/main.ts`: it refuses to boot a **production** build in mock
   mode (`throw … mock API mode`) — a real guard, read it. Then it calls
   `bootstrapApplication(App, appConfig)`.
2. Open `src/app/app.config.ts`: this is the wiring closet —
   `provideRouter(routes)` (URLs), `provideHttpClient(withInterceptors([apiInterceptor]))`
   (all HTTP + login token), `providePrimeNG(…)` (UI theme), `TitleStrategy`
   (translated browser-tab titles). If "nothing has styles" or "API calls lack
   tokens", the cause is usually here.
3. Open `src/app/app.routes.ts`: one layout (`MainLayoutComponent` =
   header + content + footer) with **lazy** children — each feature
   (`home`, `products`, `cart`, …) loads only when visited
   (`loadChildren: () => import(…)`). That is why the first paint is fast.
4. Open `src/app/layout/` and one feature folder, e.g.
   `src/app/features/products/`: `*.routes.ts` (sub-URLs),
   `*-page.component.ts` (logic) + `.html` (markup) + `.scss` (styles) —
   **separate files always** (project convention; the root `App` inline
   template is the single documented exception).
5. **Verify:** `npm run build` passes. Prediction check: delete nothing —
   instead answer: where would a "سال" (Arabic) page title come from?
   (The `LocalizedTitleStrategy` + `src/app/i18n/*.ts` dictionaries.)

## Tutorial 2: Components vs services: who does what (20 min)

**What:** the boundary reviewers enforce.
**Why:** putting HTTP calls in components (or HTML-building in services)
creates untestable spaghetti.
**How:**

1. Open `src/app/features/home/home-page.component.ts`: it *injects*
   services (`ProductService`, `CartStore`, …), keeps *signals* for display
   state, and delegates. Its `.html` only reads signals and emits events.
2. Open `src/app/core/services/product.service.ts`: the **single**
   data-access boundary for products. Mock mode returns local data;
   live mode uses `ApiClientService` + mappers in `src/app/core/api/`.
   **Components never call `HttpClient` directly** — grep to prove it:
   `HttpClient` appears only in `core/api/api-client.service.ts` (plus specs).
3. Open `src/app/models/product.model.ts`: the TypeScript shapes both sides
   agree on. If the backend renames a field, this file + the mapper change —
   never 20 components.
4. **Rule in one sentence:** components *decide what to show and what the
   user meant*; services *fetch, store, and validate*.

## Tutorial 3: Trace a real order from click to confirmation (45 min)

**What:** the money path, file by file.
**How (read in this order):**

1. **Cart state** — `core/services/cart.store.ts`: a signal of lines in
   `localStorage` (`novamart.cart.v1`); `CartViewService` joins lines with
   the catalog (unknown products render as explicit *unavailable* rows —
   they never silently vanish, and the badge always matches the rows).
2. **Checkout form** — `features/checkout/checkout-page.component.ts` (+
   `.html`): reactive form (name/phone/hotel/…), hotel directory from
   `DeliveryService`, fee **only** from `quoteFor()` (mock sample or live
   `POST /delivery/quote`), optional coupon via `POST /coupons/validate`,
   one `Idempotency-Key` per attempt so double-clicks cannot double-order.
3. **Order request** — `models/order.model.ts` (`CreateOrderRequest`):
   customer + items + subtotal + fee + total + optional `couponCode`.
   Client totals are *cross-checked input*: the backend recomputes everything.
4. **Placement** — `core/services/order.service.ts`: mock mode fakes it in
   `localStorage`; live mode `POST`s to `/orders` with the idempotency header
   and maps the response via `core/api/order.mapper.ts`.
5. **Confirmation & history** — `checkout/confirmation-page.*` reads the
   created order; `features/orders/` lists history (live: owner-scoped
   `GET /orders`; mock: device list).
6. **Verify [runs anywhere]:** `npm test` covers cart math, quote failures,
   duplicate-submit guards, and the mock/live environment split
   (`environment.guard.spec.ts`). Live click-through is **(needs API)** —
   follow [`LIVE_API_CUTOVER.md`](./LIVE_API_CUTOVER.md).

## Tutorial 4: Add a new page the safe way (45 min)

**What:** add a "Shipping info" page at `/shipping`.
**How:**

1. Create `src/app/features/shipping/` with four files:
   `shipping-page.component.ts` (+ `.html`, `.scss`, `.spec.ts`).
   Copy the shape of `src/app/features/static/not-found-page.component.*`
   (smallest real page).
2. Create `shipping.routes.ts` exporting `SHIPPING_ROUTES`, mirroring
   `src/app/features/cart/cart.routes.ts`.
3. Register one lazy line in `src/app/app.routes.ts` under the layout
   children: `{ path: 'shipping', loadChildren: () => import('./features/shipping/shipping.routes').then((m) => m.SHIPPING_ROUTES) }`.
4. Add the link where it belongs (footer nav?) and a title key in
   `src/app/i18n/en.ts` **plus all 7 other locale files**
   (`ar, cs, de, fr, it, pl, sk`) — the parity spec fails the suite otherwise
   (see [`LOCALIZATION.md`](./LOCALIZATION.md)).
5. **Verify:** `npm test` (new spec renders the page), `npm run build`,
   visit `/shipping` in mock mode, switch to Arabic (RTL must hold).
6. **What can go wrong:** eager import in `app.routes.ts` (bloats first
   paint — always `loadChildren`); missing locale keys (loud raw-key render);
   putting fetch logic in the component (use a service).

## Tutorial 5: Add or modify a reactive form (40 min)

**What:** form controls, validators, error text, safe submit.
**How (using checkout as the reference):**

1. Controls live in the `.ts` (`fb.nonNullable.group({…})`); messages live
   in the `.html` (`<mat-error>`/`<p-message>` + i18n keys); submit guards
   (`if (this.form.invalid) … markAllAsTouched()`), disables while placing,
   and surfaces *backend* errors too (live mode returns 422 field errors —
   map them onto the form or a summary line, never swallow them).
2. Validators to know: `Validators.required/email/minLength`, plus the
   project's `phoneValidator` in `src/app/shared/utils/validators.ts`.
3. Add a field (e.g. "delivery instructions"): control + template +
   en+7 locales + include in the request model + backend must accept it
   (coordinate per Tutorial 8 — the backend ignores unknown fields, so an
   uncoordinated field silently vanishes; that is the classic mistake).
4. **Verify:** spec simulates empty/invalid/valid submits;
   `npm test -- --include` the spec file for speed if supported.

## Tutorial 6: Write and debug a test (30 min)

**What:** Karma + Jasmine in headless Chrome.
**How:**

1. Run the full suite once: `npm test` (147 green is your baseline).
2. Copy `src/app/core/services/cart.store.spec.ts` (pure logic, no HTTP) or
   `src/app/core/services/account-sync.service.spec.ts` (HTTP via
   `provideHttpClientTesting()` + `HttpTestingController`) as your template.
3.Forgot `provideHttpClient()` when the service under test (transitively)
   needs HTTP? You get `NG0201: No provider found for _HttpClient` — the fix
   is always providers, never editing the service to suit the test.
4. Debug: `fit`/`fdescribe` to focus (remove before committing!),
   `console.log` in the spec, and read the first failure only — later ones
   are usually fallout.
5. **Never:** delete a failing test, weaken an assertion for green, or commit
   `fit`/`fdescribe`.

## Tutorial 7: Debug a realistic failure (30 min)

**What:** practice on a real past incident class: "Arabic page shows raw
keys like `checkout.total`".
**How:**

1. **Reproduce:** switch to Arabic, open checkout.
2. **Localize:** raw key = missing key in `ar.ts` (or a typo in the key).
   The i18n parity spec (`i18n.service.spec.ts`) catches this in CI — run
   `npm test` and read the first failure.
3. **Fix at the right layer:** add the key to the locale file(s), not a
   code fallback that hides future gaps.
4. General method: reproduce → narrow (network tab? console? which layer:
   template/service/API?) → smallest fix at the owning layer → rerun spec →
   full suite → build.
5. Project-specific map: HTTP/CORS failures → `api-client` + interceptor +
   `LIVE_API_CUTOVER.md`; wrong prices → backend recomputes (never "fix" in
   the UI); stale cart badge → `CartViewService` join logic.

## Tutorial 8 (full-stack): Connect a feature to a real endpoint (60 min)

**What:** display the backend's published CMS blocks on the homepage
(already done once — replicate the pattern for your own field).
**Why:** teaches the contract discipline both repos depend on.
**How (this order):**

1. Backend first (`D:\NovaBackend` Tutorial 8 there): endpoint live, DTO
   frozen, e.g. `GET /api/v1/content` → `[{key,title,body,…}]` (camelCase!).
2. Storefront model + mapper: extend the TS interface and the single mapper
   in `src/app/core/api/` (see `content.service.ts` + homepage usage:
   `published()` returns `[]` in mock mode — your feature must also define
   sensible mock behavior or hide itself in mock mode).
3. Service method on the domain service (not the component), template
   rendering with loading/empty states, i18n keys × 8.
4. **Verify:** `npm test`, `npm run build`, mock-mode click-through
   **[runs anywhere]**; live click-through **(needs API)**; backend tests per
   its tutorial.
5. **What can go wrong:** casing (`hotelId` vs `hotelid` — backend is
   camelCase); trusting a nullable field (guard with `??`/`?.`); changing the
   backend shape without updating the mapper (the one place this breaks).

## Tutorial 9: Review checklist before you commit

- [ ] New page lazy-loaded? No `HttpClient` outside `core/api`?
- [ ] i18n keys added to **all 8** locale files (or documented why not)?
- [ ] Loading / empty / error states for every async view?
- [ ] Forms: disabled while submitting, backend errors surfaced, no double-submit?
- [ ] Money/totals displayed only — never trusted or recomputed in the UI?
- [ ] Mobile width + Arabic RTL checked (open devtools, 360px, `ar`)?
- [ ] Specs added/updated; `npm test` green; `npm run build` passes?
- [ ] Docs touched if routes/contracts/flows/settings changed?
- [ ] No secrets, tokens, or real customer data in code or tests?
