# AuthService (mock — development only)

- File: `src/app/core/services/auth.service.ts`. Spec: `auth.service.spec.ts`.
- Root singleton; demo session. **Not secure, not real** (labeled in UI).

## Responsibility

Mock register/login/logout/password-reset against
`localStorage: novamart.mock-users.v1` + session `novamart.session.v1`.

## Public API

- `user` / `isLoggedIn` (computed over the session signal).
- `login({email,password})` — 401-shaped error on mismatch (delayed).
- `register({name,email,password,phone?})` — 409-shaped error on duplicates.
- `logout()` — clears session. `requestPasswordReset()` — resolves without
  sending anything (honest copy in UI).

## Dependencies

None (RxJS `delay` simulates latency; errors use `{status, message}`).

## Consumers

Header (menu vs link), `authGuard`, `PendingActionService.requireAuth`,
login/register/profile pages, checkout prefill + user id.

## Tests

Logged-out start, register+session, duplicate rejection, login/logout cycle,
wrong password, reset simulation.

## Safe extension

Swap method bodies for `ApiClientService` calls (`POST /auth/*`, tokens);
keep signatures and the `User` model so pages are untouched. Real flow must
add refresh-token handling and 401 recovery (see API_INTEGRATION).
