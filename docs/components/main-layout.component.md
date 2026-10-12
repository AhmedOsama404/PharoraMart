# MainLayoutComponent

## A. Component identity

- Class `MainLayoutComponent`, selector `app-main-layout`.
- `src/app/layout/main-layout.component.ts` (+ `.html`, `.scss`).
- Standalone; no inputs/outputs; no spec (static composition).

## B. Routing and navigation

Mounted once at path `''` in `src/app/app.routes.ts`; all feature routes are
its `children`, so every page renders inside it. Scroll is unaffected by the
layout itself (see `ScrollService` on detail pages).

## C. Purpose and business behavior

Owns the persistent page frame: header → routed page (`<main class="container
page">`) → footer, plus the global `<p-toast position="top-center">` and
`<p-confirmDialog>` hosts that `NotificationService` / `ConfirmationService`
target. Solves “every page needs chrome + feedback hosts” in one place.

## D. Template structure

Toast host, confirm-dialog host, `<app-header>`, `<main><router-outlet>`,
`<app-footer>` — in that order. No conditionals or lists.

## E. TypeScript functions and lifecycle

No class body members at all — pure composition.

## F. Inputs, outputs, and events

None.

## G. Services and dependencies

`HeaderComponent`, `FooterComponent` (layout), PrimeNG `Toast`,
`ConfirmDialog`, `RouterOutlet`. Must stay light: no state or services here.

## H. State and data flow

Stateless; children own their data.

## I. Localization and styling

No text of its own. `.page` sets `min-height: 60vh` and vertical padding so
short pages (login, empty cart) still push the footer down.

## J. Testing

No spec; covered indirectly by every routed-component test and browser
smoke (header/footer/toast render on each page).

## K. Safe modification guide

- New global host (e.g. a second toast position): add the element here and
  document which service targets it.
- Page spacing: adjust `.page`, not individual pages.

## L. Common pitfalls

- Removing the toast/confirm hosts silently breaks all notifications and
  the cart-clear confirmation.
