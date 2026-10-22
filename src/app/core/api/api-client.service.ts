import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject, untracked } from '@angular/core';
import { Observable, catchError, finalize, map, retry, shareReplay, tap, throwError, timeout, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConnectivityService } from '../resilience/connectivity.service';
import { I18nService } from '../services/i18n.service';
import { ApiFailure, isApiFailure, newRequestId, normalizeError } from '../resilience/api-failure';
import { SILENT_ERROR_TOAST } from './problem-details';

/**
 * Per-request switches. `silent` suppresses the global error toast so the
 * caller can render its own contextual, inline message (checkout coupon,
 * sign-in form, …) without a duplicate notification.
 */
export interface ApiRequestOptions {
  readonly silent?: boolean;
  /** Override the per-attempt timeout for a specific call. */
  readonly timeoutMs?: number;
  /** Override the GET retry budget (0 disables retries). */
  readonly retryAttempts?: number;
  /** Skip the circuit breaker (used by the recovery probe only). */
  readonly bypassBreaker?: boolean;
}

function options(silent: boolean | undefined, headers?: Record<string, string>) {
  const context = silent ? new HttpContext().set(SILENT_ERROR_TOAST, true) : undefined;
  return { headers, context };
}

/**
 * Minimal circuit breaker: after repeated transport/5xx failures, requests
 * fail immediately for a cooldown instead of waiting for every timeout. A
 * single half-open probe decides whether the backend is back.
 */
class CircuitBreaker {
  private failures = 0;
  private openUntil = 0;
  private halfOpenProbe = false;
  private readonly threshold = 5;
  private readonly cooldownMs = 15_000;

  canRequest(): boolean {
    const now = Date.now();
    if (now < this.openUntil) return false;
    if (this.openUntil > 0) {
      // Cooldown elapsed: allow exactly one probe.
      this.openUntil = 0;
      if (this.halfOpenProbe) return false;
      this.halfOpenProbe = true;
      return true;
    }
    this.halfOpenProbe = false;
    return true;
  }

  success(): void {
    this.failures = 0;
    this.openUntil = 0;
    this.halfOpenProbe = false;
  }

  failure(): void {
    this.failures += 1;
    if (this.failures >= this.threshold) {
      this.openUntil = Date.now() + this.cooldownMs;
      this.halfOpenProbe = false;
    }
  }

  /** A human pressed Retry: let the next request probe immediately. */
  reset(): void {
    this.failures = 0;
    this.openUntil = 0;
    this.halfOpenProbe = false;
  }
}

@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly http = inject(HttpClient);
  private readonly connectivity = inject(ConnectivityService);
  private readonly i18n = inject(I18nService);
  private readonly breaker = new CircuitBreaker();
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  constructor() {
    // A human Retry must be able to probe even while the breaker is cooling
    // down; otherwise the first click after an outage is a silent no-op.
    this.connectivity.onRetry?.(() => this.breaker.reset());
  }

  /**
   * In-flight GET coalescing. Two subscribers that ask for the exact same
   * resource *while the first request is still open* share one HTTP round
   * trip. The entry is removed the moment the response arrives or errors, so
   * every later call still hits the network — request coalescing, never a
   * stale-data cache, and it never covers non-GET verbs.
   */
  private readonly inFlight = new Map<string, Observable<unknown>>();

  get<T>(
    path: string,
    params?: Record<string, string | number | boolean | string[] | null | undefined>,
    optionsIn?: ApiRequestOptions,
  ): Observable<T> {
    let httpParams = new HttpParams();
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v === null || v === undefined) continue;
      if (Array.isArray(v)) {
        // ASP.NET Core binds repeated keys (tags=a&tags=b); skip empties.
        for (const one of v) if (one !== '') httpParams = httpParams.append(k, one);
      } else {
        httpParams = httpParams.set(k, String(v));
      }
    }
    const url = `${this.baseUrl}/${path.replace(/^\//, '')}`;
    const query = httpParams.toString();
    // `silent` is part of the key: a silent caller must not inherit (or leak)
    // the shared error-toast context of a loud caller on the same URL.
    // The language is part of the key too: responses are localized, so two
    // callers in different languages must never share one response body.
    // The read is untracked: a request must not become a dependency of the
    // computed/effect that happens to start it.
    const language = untracked(() => this.i18n.currentLang());
    const key = `${url}${query ? `?${query}` : ''}${optionsIn?.silent ? '|silent' : ''}|${language}`;

    const pending = this.inFlight.get(key);
    if (pending) return pending as Observable<T>;

    let request$!: Observable<T>;
    request$ = this.execute<T>(
      url,
      () => this.http.get<T>(url, { params: httpParams, ...options(optionsIn?.silent) }),
      optionsIn,
    ).pipe(
      // `finalize` (not `tap`) so the entry is released when the request
      // completes, fails — or is CANCELLED because its last subscriber left.
      // The identity check keeps a late teardown from deleting a newer entry
      // that happens to use the same key.
      finalize(() => {
        if (this.inFlight.get(key) === request$) this.inFlight.delete(key);
      }),
      // `refCount: true` ties the request to its subscribers: when the last
      // one leaves, the browser aborts the XHR. An abandoned request (the
      // visitor left the page) then costs nothing and can never trip the
      // circuit breaker on its way out.
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.inFlight.set(key, request$);
    return request$;
  }

  /**
   * Shape-safe GET: the mapper converts an unknown body to a typed value with
   * lenient defaults. A missing/null/wrong field yields the fallback instead
   * of throwing inside a component. HTTP failures still propagate.
   */
  getSafe<T>(
    path: string,
    params: Record<string, string | number | boolean | string[] | null | undefined> | undefined,
    mapper: (raw: unknown) => T,
    fallback: () => T,
    optionsIn?: ApiRequestOptions,
  ): Observable<T> {
    return this.get<unknown>(path, params, optionsIn).pipe(
      map((raw) => {
        try {
          return mapper(raw);
        } catch {
          return fallback();
        }
      }),
    );
  }

  post<T>(
    path: string,
    body: unknown,
    headers?: Record<string, string>,
    optionsIn?: ApiRequestOptions,
  ): Observable<T> {
    const url = `${this.baseUrl}/${path.replace(/^\//, '')}`;
    return this.execute<T>(
      url,
      () => this.http.post<T>(url, body, options(optionsIn?.silent, headers)),
      { ...optionsIn, retryAttempts: 0 },
    );
  }

  put<T>(
    path: string,
    body: unknown,
    headers?: Record<string, string>,
    optionsIn?: ApiRequestOptions,
  ): Observable<T> {
    const url = `${this.baseUrl}/${path.replace(/^\//, '')}`;
    return this.execute<T>(
      url,
      () => this.http.put<T>(url, body, options(optionsIn?.silent, headers)),
      { ...optionsIn, retryAttempts: 0 },
    );
  }

  delete<T>(
    path: string,
    headers?: Record<string, string>,
    optionsIn?: ApiRequestOptions,
  ): Observable<T> {
    const url = `${this.baseUrl}/${path.replace(/^\//, '')}`;
    return this.execute<T>(
      url,
      () => this.http.delete<T>(url, options(optionsIn?.silent, headers)),
      { ...optionsIn, retryAttempts: 0 },
    );
  }

  /**
   * One request with a hard timeout, classification, connectivity reporting,
   * optional jittered retries, and the shared breaker.
   */
  private execute<T>(
    url: string,
    factory: () => Observable<T>,
    optionsIn?: ApiRequestOptions,
  ): Observable<T> {
    const timeoutMs = Math.max(1_000, optionsIn?.timeoutMs ?? environment.requestTimeoutMs ?? 10_000);
    const attempts = Math.max(0, optionsIn?.retryAttempts ?? environment.getRetryAttempts ?? 2);

    if (!optionsIn?.bypassBreaker && !this.breaker.canRequest()) {
      const breakerFailure = new ApiFailure({
        status: 0,
        kind: 'network',
        retryable: false,
        messageKey: 'resilience.networkTitle',
        requestId: newRequestId(),
        detail: 'circuit breaker open',
        url,
      });
      return throwError(() => breakerFailure);
    }

    const once = () =>
      factory().pipe(
        timeout({
          each: timeoutMs,
          with: () => throwError(() => new ApiFailure({
            status: 0,
            kind: 'timeout',
            retryable: true,
            messageKey: 'resilience.timeoutTitle',
            requestId: newRequestId(),
            detail: `request exceeded ${timeoutMs} ms`,
            url,
          })),
        }),
        catchError((err: unknown) => {
          const failure = normalizeError(err, url);
          if (failure.kind === 'network' || failure.kind === 'offline' || failure.kind === 'timeout' || failure.kind === 'server' || failure.kind === 'parse') {
            this.breaker.failure();
            this.connectivity.markFailure(failure);
          } else {
            this.breaker.success();
            this.connectivity.markSuccess();
          }
          return throwError(() => failure);
        }),
      );

    return once().pipe(
      tap(() => {
        this.breaker.success();
        this.connectivity.markSuccess();
      }),
      retry({
        count: attempts,
        delay: (error: unknown, retryCount: number) => {
          const failure = isApiFailure(error) ? error : normalizeError(error, url);
          if (!failure.retryable || attempts === 0) return throwError(() => failure);
          const base = 300 * 2 ** Math.max(0, retryCount - 1);
          const jitter = Math.floor(Math.random() * 200);
          return timer(base + jitter);
        },
      }),
    );
  }
}
