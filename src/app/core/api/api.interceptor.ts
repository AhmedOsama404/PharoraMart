import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';
import { ApiErrorService } from '../services/api-error.service';
import { I18nService } from '../services/i18n.service';
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
 * Callers that render their own inline message (checkout coupon, sign-in)
 * pass `{ silent: true }` to `ApiClientService` — the request then carries
 * `SILENT_ERROR_TOAST` and no duplicate toast is shown.
 */
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
  return next(authReq).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && !req.context.get(SILENT_ERROR_TOAST)) {
        const resolved = apiError.resolve(err);
        notify.error(resolved.key, resolved.params);
      }
      return throwError(() => err);
    }),
  );
};
