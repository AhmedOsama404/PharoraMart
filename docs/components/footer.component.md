# FooterComponent

## A. Component identity

- Class `FooterComponent`, selector `app-footer`.
- `src/app/layout/footer.component.ts` (+ `.html`, `.scss`).
- Standalone + OnPush; no inputs/outputs; no spec.

## B. Routing and navigation

Embedded in `MainLayoutComponent`. Links to `/products` (incl. sale query),
`/favorites`, `/cart`, `/orders`, `/checkout`, `/auth/login`. External links:
`mailto:` support email and `wa.me` WhatsApp number (new tab, `noopener`).

## C. Purpose and business behavior

Brand column (tagline, email, WhatsApp, business hours), shop/support
navigation, and a currency selector. Contact details come from
`ContactService` (environment-backed, dashboard-owned later) — never
hardcoded in the template. The bottom bar carries copyright plus the honest
mock-mode notice.

## D. Template structure

Four-column grid (brand, shop nav, support nav, prefs) collapsing to 2 then
1 column; bottom bar with rights + mock notice.

## E. TypeScript functions and lifecycle

- `businessHours()` — returns `contact.businessHours` (environment config).
- `onCurrency(code)` — persists via `CurrencyService`.
- `currencyOptions` is a stable property (built once, not per cycle).
- No lifecycle hooks, signals, or subscriptions.

## F. Inputs, outputs, and events

None.

## G. Services and dependencies

`I18nService` (all labels), `CurrencyService` (selector), `ContactService`
(email/number/hours getters), `RouterLink`, PrimeNG `Select`.

## H. State and data flow

Stateless; reads shared services only.

## I. Localization and styling

Fully translated incl. `footer.hoursLabel`. Dark `#0f172a` panel, responsive
grid, `.contact a/span` rows with icons.

## J. Testing

No spec; covered by browser smoke (links, currency switch, AR mirroring).

## K. Safe modification guide

- New contact channel: add a getter to `ContactService` + environment key +
  template row + `footer.*` label (all eight languages).
- New link column: extend the grid; check the 560px single-column fallback.

## L. Common pitfalls

- Hardcoding phone/email in the template (breaks dashboard configurability).
- Forgetting a translation key in any of the eight dictionaries.
