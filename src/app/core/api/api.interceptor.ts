import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';

/** Centralized HTTP error mapping → localized toast. Auth header hook for future API. */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  let token: string | null = null;
  try {
    const raw = localStorage.getItem('novamart.session.v1');
    token = raw ? (JSON.parse(raw) as { token?: string }).token ?? null : null;
  } catch {
    token = null;
  }
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  const notify = inject(NotificationService);
  return next(authReq).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        notify.error(err.status === 0 ? 'errors.generic' : 'notifications.loadFailed');
      }
      return throwError(() => err);
    }),
  );
};
