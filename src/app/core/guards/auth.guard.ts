import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { PendingActionService, type GateReason } from '../services/pending-action.service';

/** Maps an account-protected URL to its friendly explanation message. */
function reasonFor(url: string): GateReason {
  if (url.startsWith('/favorites')) return 'addToFavorites';
  if (url.startsWith('/checkout')) return 'checkout';
  return 'account';
}

/**
 * Redirects guests to login, preserving the requested URL for post-login
 * return. The reason is stored alongside so the login page can explain why.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const pending = inject(PendingActionService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  const reason = reasonFor(state.url);
  pending.request(state.url, reason);
  pending.explain(reason);
  return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
};
