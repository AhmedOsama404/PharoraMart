# RegisterPageComponent

## A. Component identity

- Class `RegisterPageComponent`, selector `app-register-page`.
- `src/app/features/auth/register-page.component.ts` (+ `.html`, `.scss`).
- Standalone + OnPush; no inputs/outputs; no spec.

## B. Routing and navigation

Route `/auth/register` (`?returnUrl=` preserved). Links back to login;
same post-success contract as login (`completeSignUp()`), same signed-in
redirect. No scroll handling.

## C. Purpose and business behavior

Mock sign-up (development-only): name/email/phone/password/confirm with
match validator, 409-aware error messaging (address taken vs generic),
welcome toast, then the identical consume → navigate → run-action flow.

## D. Template structure

Centered card (≤30rem): title/subtitle, demo notice, pending-reason banner,
five fields with inline errors (incl. group-level password-mismatch),
server error, submit with loading, back-to-login link.

## E. TypeScript functions and lifecycle

- `form` with `passwordMatchValidator` (group-level); `err()` per field;
  mismatch message reads `form.errors` when confirm is touched/dirty.
- `keepReturn()`, `ngOnInit` loop guard, `pendingReason` banner,
  `submit()`, `completeSignUp()` — same contract as login's
  `completeSignIn()` (see that doc).

## F. Inputs, outputs, and events

None.

## G. Services and dependencies

Same as login plus `passwordMatchValidator`/`phoneValidator` from
`shared/utils/validators`.

## H. State and data flow

Same as login: local form state + intent peek/consume.

## I. Localization and styling

Translated copy/validation; same card pattern as login; RTL-safe.

## J. Testing

No spec. Covered by `auth.service.spec` (register/409) and browser runs.

## K. Safe modification guide

- Keep the post-success path identical to login (one flow, two entries).
- New field: same checklist as login + confirm any cross-field rule with a
  group validator + template message.

## L. Common pitfalls

- Duplicating the return/action logic instead of mirroring it (the two must
  stay behaviorally identical).
