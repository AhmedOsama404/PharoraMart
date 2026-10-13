# Glossary — Plain-Language Definitions

**Angular:** Google's framework for building web apps in TypeScript. Version 20
here. You write components; Angular renders them and keeps the page updated.

**Component:** a UI building block — a `.ts` class (logic) + `.html` template
(markup) + `.scss` (styles) + usually a `.spec.ts` test. Example:
`src/app/features/cart/cart-page.component.*`.

**Service:** a shared logic class, usually `providedIn: 'root'` (one instance
for the whole app). Examples: `ProductService` (fetching),
`CartStore` (cart state), `AuthService` (session). Components *use* services;
services never build HTML.

**Store (here):** a service that *owns* client state in a signal, e.g.
`CartStore.lines`, `FavoritesStore.ids`. Compare: backend "store" means the shop.

**Signal:** Angular's reactive value: `count = signal(0)`; templates calling
`count()` re-render automatically when it changes via `count.set(1)`.

**Observable / RxJS:** a stream of async values (HTTP responses, debounced
search). You `subscribe` to receive them; `pipe(map(…))` transforms them.
HTTP always returns observables — that is why API calls look different from
signal reads.

**Routing / lazy loading:** `src/app/app.routes.ts` maps URLs to components.
`loadChildren: () => import(…)` means the feature's code downloads *only when
visited* — keep it that way for new pages.

**Guard:** a gatekeeper on a route (e.g. checkout requires sign-in;
`core/guards/auth.guard.ts`). Unauthenticated visits redirect to login with a
`returnUrl` so the intended click completes afterwards
(`PendingActionService`).

**Interceptor:** code that touches *every* HTTP request/response —
`core/api/api.interceptor.ts` attaches the login token and maps errors to
user-facing messages.

**Reactive forms:** form state as code (`FormBuilder.group`, validators),
used by checkout. Template shows `<mat-error>` per control; submit is
disabled while invalid or placing.

**Mock mode vs live mode:** `useMockApi:true` (dev default) serves local fake
data with simulated delays; `false` calls the real backend. Production builds
*refuse to boot* in mock mode (`src/main.ts`). See
[`LIVE_API_CUTOVER.md`](./LIVE_API_CUTOVER.md).

**DTO / model / mapper:** backend JSON shapes are re-declared as TypeScript
interfaces in `src/app/models/`; `src/app/core/api/*.mapper.ts` convert wire
shapes to UI shapes in exactly one place each.

**Idempotency-Key:** a per-attempt header sent with `POST /orders` so retries
and double-clicks create one order, not two.

**JWT / token:** the login proof string from `POST /auth/login`, stored in
`localStorage` (`novamart.session.v1`) and attached by the interceptor.
Mock tokens look like `mock.<id>.<ts>` and are worthless outside the demo.

**i18n / locale:** internationalization — all UI text lives in
`src/app/i18n/{en,ar,cs,de,fr,it,pl,sk}.ts`, looked up by key
(`i18n.t('checkout.total')`). Arabic (`ar`) additionally flips layout to
right-to-left (RTL). Missing keys render loudly as the key itself.

**PrimeNG:** the UI component library used here (buttons, dialogs, carousels;
theme preset in `src/app/core/config/theme.preset.ts`). Dashboard repo must
*not* use it — that rule does not apply to this storefront.

**Karma / Jasmine:** the test runner (`npm test`) and the test-writing
library (`describe/it/expect`). Runs in headless Chrome; 147 specs green is
your baseline.
