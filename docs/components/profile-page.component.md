# ProfilePageComponent

## A. Component identity

- Class `ProfilePageComponent`, selector `app-profile-page`.
- `src/app/features/auth/profile-page.component.ts` (+ `.html`, `.scss`).
- Standalone + OnPush; no inputs/outputs; no spec.

## B. Routing and navigation

Route `/auth/profile` with `canActivate: [authGuard]`. Buttons to `/orders`
and logout-to-`/`.

## C. Purpose and business behavior

Basic account profile UI over the mock session: name/email/phone display,
demo notice, shortcuts to orders and logout.

## D. Template structure

Title/subtitle, demo notice, detail card (label/value rows), action row.

## E. TypeScript functions and lifecycle

- `go(path)`, `logout()` (clears session → home). No signals beyond reads.

## F. Inputs, outputs, and events

None.

## G. Services and dependencies

`AuthService` (user + logout), `I18nService`, `Router`. PrimeNG: Button,
Card, Message.

## H. State and data flow

Reads `auth.user()`; mutates session only via logout.

## I. Localization and styling

Translated labels; narrow card; RTL-safe.

## J. Testing

No spec. Future: harness spec for session display + logout navigation.

## K. Safe modification guide

- New profile field: read from `User`, add a row + label key (8 languages).
- Real profile editing later: form + API method on `AuthService`.

## L. Common pitfalls

- Displaying session data as verified identity (mock session, labeled).
