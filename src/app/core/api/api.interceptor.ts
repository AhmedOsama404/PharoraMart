import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';
import { ApiErrorService } from '../services/api-error.service';
import { I18nService } from '../services/i18n.service';
import { AuthService } from '../services/auth.service';
import { SILENT_ERROR_TOAST } from './problem-details';

/**
 * Centralized HTTP concerns: attach the Bearer token, negotiate the response
 * language, and turn any failure into ONE localized toast. The message comes
 * from the backend's stable `code` (or the status), never from raw server
 * prose, so every one of the eight languages reads correctly.
 *
 * Every request carries `Accept-Language` with the user's selected locale, so
 * backend-localized content (e.g. error titles in `ErrorCatalog`) is returned
 * in that language instead of falling back to `en`.
 *
 * A 401 on a request that carried a token means the stored session died
 * server-side: the stale credentials are cleared once (AuthService), the
 * localized "session expired" notice re-issues at most once per cooldown so a
 * burst of parallel failures never spams the screen, and sign-in/register
 * failures are excluded — a 401 there is wrong credentials, not expiry, and
 * those forms render inline.
 *
 * Callers that render their own inline message (checkout coupon, sign-in)
 * pass `{ silent: true }` to `ApiClientService` — the request then carries
 * `SILENT_ERROR_TOAST` and no duplicate toast is shown.
 */

/** Auth calls: their 4xx are credential errors, never an expired session. */
const AUTH_CALLS = ['/auth/login', '/auth/register'];
/** One burst of simultaneous 401s = one notice; a later, fresh failure speaks again. */
const EXPIRY_NOTICE_COOLDOWN_MS = 15_000;

let lastExpiryNoticeAt = 0;

/** Test hook: clears the expiry-notice cooldown state between spec runs. */
export function resetExpiryNoticeStateForTests(): void {
  lastExpiryNoticeAt = 0;
}

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  let token: string | null = null;
  try {
    const raw = localStorage.getItem('novamart.session.v1');
    token = raw ? (JSON.parse(raw) as { token?: string }).token ?? null : null;
  } catch {
    token = null;
  }
  const i18n = inject(I18nService);
  const setHeaders: Record<string, string> = { 'Accept-Language': i18n.currentLang() };
  const authReq = token
    ? req.clone({ setHeaders: { ...setHeaders, Authorization: `Bearer ${token}` } })
    : req.clone({ setHeaders });

  const notify = inject(NotificationService);
  const apiError = inject(ApiErrorService);
  const auth = inject(AuthService);
  return next(authReq).pipe(
    catchError((err: unknown) => {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        token !== null &&
        !AUTH_CALLS.some((path) => req.url.includes(path))
      ) {
        // Dead token: reset session state to signed-out (idempotent) so later
        // requests stop carrying it and guarded routes re-gate at once.
        auth.sessionExpired();
        const now = Date.now();
        if (now - lastExpiryNoticeAt >= EXPIRY_NOTICE_COOLDOWN_MS) {
          lastExpiryNoticeAt = now;
          const resolved = apiError.resolve(err);
          notify.error(resolved.key, resolved.params);
        }
        return throwError(() => err);
      }
      if (err instanceof HttpErrorResponse && !req.context.get(SILENT_ERROR_TOAST)) {
        const resolved = apiError.resolve(err);
        notify.error(resolved.key, resolved.params);
      }
      return throwError(() => err);
    }),
  );
};
