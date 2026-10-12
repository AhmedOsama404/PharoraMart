# App (root shell)

## A. Component identity

- Class `App`, selector `app-root`, `src/app/app.ts`.
- No separate HTML/SCSS — the only intentional inline exception in the
  project (documented in the file): the shell is a single `<router-outlet />`
  with no markup or styling of its own.
- Standalone (`imports: [RouterOutlet]`).
- Spec: `src/app/app.spec.ts` (creation test).

## B. Routing and navigation

No route of its own; it *hosts* the router. All navigation flows through its
outlet into `MainLayoutComponent` (see `src/app/app.routes.ts`).

## C. Purpose and business behavior

Bootstraps Angular (`src/main.ts` → `bootstrapApplication(App, appConfig)`).
Owns nothing else — layout, state, and pages live downstream.

## D. Template structure

One element: `<router-outlet />`. No states, forms, or children of its own.

## E. TypeScript functions and lifecycle

No methods, signals, or lifecycle hooks. No subscriptions.

## F. Inputs, outputs, and events

None.

## G. Services and dependencies

Only `RouterOutlet` (Angular router). `appConfig` providers (router,
`HttpClient`, PrimeNG, toast/confirm services, title strategy) are wired in
`src/app/app.config.ts`, not here.

## H. State and data flow

Stateless.

## I. Localization and styling

No text, no styles.

## J. Testing

`app.spec.ts` asserts creation. Run: `npx ng test --include='**/app.spec.ts'`.

## K. Safe modification guide

You should never need to change this file. To alter the shell, edit
`MainLayoutComponent`; to alter startup providers, edit `app.config.ts`.

## L. Common pitfalls

- Adding markup here breaks the single-outlet convention; put layout in
  `layout/` instead.
