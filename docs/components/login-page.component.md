# LoginPageComponent

## A. Component identity

- Class `LoginPageComponent`, selector `app-login-page`.
- `src/app/features/auth/login-page.component.ts` (+ `.html`, `.scss`).
- Standalone + OnPush; no inputs/outputs; no spec.

## B. Routing and navigation

Route `/auth/login` (accepts `?returnUrl=`). Links to forgot/register
(preserving `returnUrl` via `keepReturn()`), guest shopping, and — on
success — the validated return URL. Already-signed-in visits redirect away
(no login/register loop). Part of the guest→intent→return flow owned by
`PendingActionService`.

## C. Purpose and business behavior

Mock sign-in (development-only, labeled as such): validated form, loading
state, friendly server errors, welcome toast, then `completeSignIn()` —
consume the pending intent exactly once, navigate to the safe return URL,
and run the stored shopping action so its toast appears in context.

## D. Template structure

Centered card: title/subtitle, demo notice, pending-reason banner
(`gate.title — gate.<reason>`, conditional), email + password fields with
inline errors, server error, submit button with loading state, link block.

## E. TypeScript functions and lifecycle

- `form` (email required+format, password required ≥6).
- `keepReturn()` — preserves `returnUrl` across auth-page hops.
- `ngOnInit` — signed-in users leave immediately (loop prevention).
- `pendingReason` — banner reason from the unconsumed intent.
- `err(name)` — control errors → `validation.*` keys.
- `submit()` — touch-all on invalid; `auth.login` → success toast +
  `completeSignIn()`; failure → server error + error toast, intent kept.
- `completeSignIn()` — `consume()` → safe URL → navigate → `runAction()`.

## F. Inputs, outputs, and events

None (page-level; form `ngSubmit` handled in `submit()`).

## G. Services and dependencies

`AuthService`, `PendingActionService`, `NotificationService`, `Router`,
`ActivatedRoute`, `I18nService`, `FormBuilder`. PrimeNG: Button, Card,
InputText, Message, Password.

## H. State and data flow

Local `busy`/`serverError` + form; session via `AuthService`; intent via
`PendingActionService` (peek for banner, consume on success).

## I. Localization and styling

All copy/validation translated; password visibility toggle has
localized labels; centered card ≤28rem; RTL-safe.

## J. Testing

No spec. Covered by `auth.service.spec` (mock login) and the browser
gated-journey run. Future: harness spec for banner + return navigation.

## K. Safe modification guide

- New field: form control + template field + validation + submit mapping.
- Keep `completeSignIn()` as the single post-login path; never navigate
  without consuming the intent (or actions run twice / never).

## L. Common pitfalls

- Trusting `returnUrl` without `safeReturnUrl` (open redirect).
- Consuming the intent before success (failed logins would lose it).
- Presenting mock login as secure (keep the demo notice).
