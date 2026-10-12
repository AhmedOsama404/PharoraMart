# ForgotPageComponent

## A. Component identity

- Class `ForgotPageComponent`, selector `app-forgot-page`.
- `src/app/features/auth/forgot-page.component.ts` (+ `.html`, `.scss`).
- Standalone + OnPush; no inputs/outputs; no spec.

## B. Routing and navigation

Route `/auth/forgot`; links back to login. No return-URL handling (reset
does not continue a shopping flow).

## C. Purpose and business behavior

Demo password-reset request: validated email, loading state, success notice.
Honestly labeled — resolves without sending any email (see subtitle +
`auth.forgotSent` copy).

## D. Template structure

Centered card: title, explanatory subtitle, success message (conditional),
email field + error, submit button, back-to-login link.

## E. TypeScript functions and lifecycle

- `form` (email required+format); `err()`; `submit()` → touch-all →
  `requestPasswordReset` → `sent` flag (failure only clears `busy`).
- `busy`/`sent` signals.

## F. Inputs, outputs, and events

None.

## G. Services and dependencies

`AuthService`, `I18nService`, `FormBuilder`. PrimeNG: Button, Card,
InputText, Message.

## H. State and data flow

Local only; no session/intent interaction.

## I. Localization and styling

Translated copy incl. the no-email disclaimer; same card pattern; RTL-safe.

## J. Testing

No spec. Trivial flow; covered by browser smoke.

## K. Safe modification guide

- Real reset flow later: point `submit()` at the API method, keep the
  always-200 UX (no account disclosure), update the subtitle copy.

## L. Common pitfalls

- Implying an email was sent (keep the honest wording).
