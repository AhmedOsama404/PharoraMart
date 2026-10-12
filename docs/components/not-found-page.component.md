# NotFoundPageComponent

## A. Component identity

- Class `NotFoundPageComponent`, selector `app-not-found-page`.
- `src/app/features/static/not-found-page.component.ts` (+ `.html`, `.scss`).
- Standalone + OnPush; no inputs/outputs; no spec.

## B. Routing and navigation

Route `/not-found` (`data.titleKey: meta.notFound`); catch-all `**`
redirects here. Single action back to `/`.

## C. Purpose and business behavior

Friendly 404 for unknown URLs (incl. retired product/category links).

## D. Template structure

Centered code/title/subtitle + home button.

## E. TypeScript functions and lifecycle

Stateless; only `i18n` injection.

## F. Inputs, outputs, and events

None.

## G. Services and dependencies

`I18nService`, `RouterLink`, PrimeNG `Button`.

## H. State and data flow

Stateless.

## I. Localization and styling

Translated copy; centered; RTL-safe.

## J. Testing

No spec. Covered by router smoke (unknown URL lands here).

## K. Safe modification guide

- New recovery action: add a second button with an internal route.

## L. Common pitfalls

- Linking to routes that no longer exist.
