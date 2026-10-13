# Storefront Learning Path for New Developers

Welcome! This is your course map for the PharoraMart **storefront**: an
**Angular 20** web shop (TypeScript) where hotel guests browse cosmetics and
herbs in **8 languages**, add items to a cart, check out with hotel delivery,
and track orders. It talks to the ASP.NET Core backend at `D:\NovaBackend`
over HTTP — or runs on built-in **mock data** for offline development.

You do **not** need to know Angular yet. Each topic tells you *what* it is,
*why* it matters, *where* it lives here, and *what to read next*. Follow the
path in order.

**Companion repos:** backend course at
`D:\NovaBackend\docs\LEARNING_PATH.md`; the two must agree on API contracts
(see [TUTORIALS.md — Tutorial 8](./TUTORIALS.md#tutorial-8-full-stack-connect-a-feature-to-a-real-endpoint-60-min)).

## Step 0 — Get the shop running

**What:** install Node packages, start the dev server, run the tests.
**Where:** [`GETTING_STARTED.md`](./GETTING_STARTED.md),
[`LIVE_API_CUTOVER.md`](./LIVE_API_CUTOVER.md) (mock vs live modes),
[`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md).
**Verify:** `npm start` → open `http://localhost:4200` and see products;
`npm test` → 147 specs pass in ChromeHeadless.

## Step 1 — Understand Angular through this app (45 min)

**What:** the framework pieces this project actually uses — *components*
(UI + external `.html` template + `.scss` styles), *services* (shared logic,
`providedIn: 'root'` = one instance app-wide), *routing* (URL → component),
*signals* (reactive values the template re-reads automatically),
*observables* (async streams from HTTP, consumed with `subscribe` or
`async`), *reactive forms* (checkout form with validators), *guards*
(checkout requires sign-in), *interceptors* (attach the login token to every
API call), *pipes* (formatting in templates).
**Why:** every file you open is one of these; naming the pattern tells you
what the file is allowed to do.
**Where:** [`ARCHITECTURE.md`](./ARCHITECTURE.md),
[`PROJECT_STRUCTURE.md`](./PROJECT_STRUCTURE.md),
[`CODING_STANDARDS.md`](./CODING_STANDARDS.md).
**Jargon help:** [`GLOSSARY.md`](./GLOSSARY.md).

## Step 2 — Follow the startup path (30 min)

**What:** what happens between `npm start` and pixels.
**Where:** [TUTORIALS.md — Tutorial 1](./TUTORIALS.md#tutorial-1-tour-the-app-from-bootstrap-to-pixels-25-min).
**Files you will meet:** `src/main.ts` (production mock-mode guard!) →
`src/app/app.config.ts` (router, HTTP + token interceptor, PrimeNG theme,
localized page titles) → `src/app/app.routes.ts` (lazy feature routes under
`MainLayoutComponent`) → `src/app/layout/` (header/footer shell).

## Step 3 — Follow one shopper end to end (45 min)

**What:** catalog → product page → cart → checkout → confirmation → orders.
**Where:** [TUTORIALS.md — Tutorial 3](./TUTORIALS.md#tutorial-3-trace-a-real-order-from-click-to-confirmation-45-min),
then [`CART_AND_CHECKOUT.md`](./CART_AND_CHECKOUT.md) (the money path) and
[`STATE_MANAGEMENT.md`](./STATE_MANAGEMENT.md) (who owns cart, favorites,
auth, quotes).

## Step 4 — Mock vs live, auth, languages (45 min)

**What:** the two data modes, how sign-in and the token work, and how 8
languages + RTL stay consistent.
**Where:** [`LIVE_API_CUTOVER.md`](./LIVE_API_CUTOVER.md),
[`API_INTEGRATION.md`](./API_INTEGRATION.md) + [`API_CONTRACT.md`](./API_CONTRACT.md),
[`LOCALIZATION.md`](./LOCALIZATION.md) + [`TRANSLATION_REFERENCE.md`](./TRANSLATION_REFERENCE.md),
[`DATA_MODELS.md`](./DATA_MODELS.md).

## Step 5 — Change the code safely (hands-on)

- **Add a page:** [TUTORIALS.md — Tutorial 4](./TUTORIALS.md#tutorial-4-add-a-new-page-the-safe-way-45-min).
- **Change/add a form:** [TUTORIALS.md — Tutorial 5](./TUTORIALS.md#tutorial-5-add-or-modify-a-reactive-form-40-min) +
  [`FEATURE_DEVELOPMENT_GUIDE.md`](./FEATURE_DEVELOPMENT_GUIDE.md).
- **Connect a real endpoint:** [TUTORIALS.md — Tutorial 8](./TUTORIALS.md#tutorial-8-full-stack-connect-a-feature-to-a-real-endpoint-60-min).
- **Write/debug tests:** [TUTORIALS.md — Tutorial 6](./TUTORIALS.md#tutorial-6-write-and-debug-a-test-30-min) + [`TESTING.md`](./TESTING.md).
- **Debug a failure:** [TUTORIALS.md — Tutorial 7](./TUTORIALS.md#tutorial-7-debug-a-realistic-failure-30-min).

## Step 6 — Go deeper when needed

| Question | Read |
|---|---|
| Every route and component | [`COMPONENTS_AND_ROUTES.md`](./COMPONENTS_AND_ROUTES.md), [`components/README.md`](./components/README.md) |
| Every service/store | [`services/README.md`](./services/README.md) |
| Styling, responsive, a11y | [`CODING_STANDARDS.md`](./CODING_STANDARDS.md), component `.scss` files |
| Deploying the static build | [`HOSTING.md`](./HOSTING.md) |
| What changed recently | [`CHANGELOG.md`](./CHANGELOG.md) |
| Demo mode for clients | [`CLIENT_DEMO.md`](./CLIENT_DEMO.md) |

## Keeping docs true

Same rule as the backend: when you change a route, contract, flow, setting,
or behavior, update the matching document in the same change (checklist:
[TUTORIALS.md — Tutorial 9](./TUTORIALS.md#tutorial-9-review-checklist-before-you-commit)).
