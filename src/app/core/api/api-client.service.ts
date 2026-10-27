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
 * Minimal circuit breaker: after *repeated, separate* transport/5xx failures,
 * requests fail immediately for a cooldown instead of waiting for every
 * timeout. A single half-open probe decides whether the backend is back.
 */
class CircuitBreaker {
  private failures = 0;
  private openUntil = 0;
  private probeOutstanding = false;
  private lastCountedAt = 0;
  private readonly threshold = 5;
  private readonly cooldownMs = 15_000;
  /** Failures closer together than this are the same incident. */
  private readonly incidentWindowMs = 2_000;

  /** `reject` = cooling down; `probe` = this caller holds the half-open slot. */
  canRequest(): 'allow' | 'probe' | 'reject' {
    const now = Date.now();
    if (now < this.openUntil) return 'reject';
    if (this.openUntil > 0) {
      // Cooldown elapsed: the first caller through the door becomes the probe
      // and the cooldown is retired, so a whole fan-out no longer re-enters a
      // still-degraded backend at once. Callers that arrive after that probe are
      // deliberately allowed through rather than queued behind it: refusing them
      // is how a healthy-but-slow server ends up looking unreachable.
      this.openUntil = 0;
      if (this.probeOutstanding) return 'reject';
      this.probeOutstanding = true;
      return 'probe';
    }
    return 'allow';
  }

  /** Release the half-open slot when the probe settles OR is cancelled. */
  releaseProbe(): void {
    this.probeOutstanding = false;
  }

  success(): void {
    this.failures = 0;
    this.openUntil = 0;
    this.probeOutstanding = false;
    this.lastCountedAt = 0;
  }

  /**
   * Record the outcome of one request.
   *
   * Failures that land inside the incident window are ONE verdict about the
   * server, not several. The storefront opens ~9 independent GETs at startup,
   * so a backend that is merely saturated times all of them out in the same
   * instant; counting each one reached the five-failure threshold on a single
   * page load and cut the app off from a server that was still answering. A
   * backend that is genuinely unreachable keeps failing across the window, so
   * the protection still trips — it just can no longer trip on one burst.
   */
  failure(): void {
    const now = Date.now();
    if (now - this.lastCountedAt >= this.incidentWindowMs) {
      this.failures += 1;
      this.lastCountedAt = now;
    }
    if (this.failures >= this.threshold) {
      this.openUntil = now + this.cooldownMs;
    }
    this.probeOutstanding = false;
  }

  /** A human pressed Retry: let the next request probe immediately. */
  reset(): void {
    this.failures = 0;
    this.openUntil = 0;
    this.probeOutstanding = false;
    this.lastCountedAt = 0;
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
    // The liveness probe is a raw `fetch`, so it never passes through this
    // client and can never clear the breaker itself. Without this hook a
    // successful probe flips the app back to 'online' and fires `recovered$`,
    // and every refetch it triggers is then rejected by the very gate that
    // only a successful request could open — the reported "backend is running
    // but requests fail".
    this.connectivity.onRecover(() => this.breaker.reset());
  }

  /**
   * In-flight GET coalescing. Two subscribers that ask for the exact same
   * resource *while the first request is still open* share one HTTP round
   * trip. The entry is removed the moment the response arrives or errors, so
   * every later call still hits the network — request coalescing, never a
   * stale-data cache, and it never covers non-GET verbs.
   */
  private readonly inFlight = new Map<string, Observable<unknown>>();

  /**
   * Monotonic count of retries actually issued, across every request. Read
   * only to spot *correlated* failures — see `execute`. Never feeds the breaker,
   * which still counts one outcome per request.
   */
  private retriesIssued = 0;

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
   *
   * The breaker and the offline banner are fed ONCE PER REQUEST, after the
   * retry budget is spent — never per attempt. Counting attempts made two
   * merely-slow GETs (3 + 2 attempts) satisfy the five-failure threshold and
   * open the circuit against a perfectly healthy backend, which then failed
   * every later request for the whole cooldown. That was the reported
   * "pending, then everything fails" cascade. Counting *requests* still over-
   * reacted, because one saturated page load is nine requests failing at the
   * same instant — see `CircuitBreaker.failure`.
   */
  private execute<T>(
    url: string,
    factory: () => Observable<T>,
    optionsIn?: ApiRequestOptions,
  ): Observable<T> {
    const timeoutMs = Math.max(1_000, optionsIn?.timeoutMs ?? environment.requestTimeoutMs ?? 10_000);
    const attempts = Math.max(0, optionsIn?.retryAttempts ?? environment.getRetryAttempts ?? 2);
    // Retries counted at the moment this request began, so only failures that
    // belong to *other* requests can be detected later on.
    const retriesAtStart = this.retriesIssued;
    let ownRetries = 0;
    // A per-attempt watchdog alone let a stalling request occupy the browser's
    // connection pool for attempts x timeout. The total budget keeps the worst
    // case bounded so the UI resolves instead of spinning.
    const totalMs = Math.max(timeoutMs, Math.min(timeoutMs * (attempts + 1), 20_000));

    const gate = optionsIn?.bypassBreaker ? 'allow' : this.breaker.canRequest();
    if (gate === 'reject') {
      const breakerFailure = new ApiFailure({
        status: 0,
        kind: 'network',
        retryable: false,
        messageKey: 'resilience.networkTitle',
        requestId: newRequestId(),
        detail: 'circuit breaker open',
        url,
      });
      // A request the client refused never reached the network, so it is not
      // evidence about the server and deliberately skips `breaker.failure()` —
      // feeding it back would extend the cooldown on every attempt and make the
      // outage self-sustaining. It is, however, evidence that the visitor is
      // looking at a blocked app, so it reports the state and asks for the one
      // check that can clear it. Before this, a gated request produced an error
      // screen while the status still read `online` and the next health check
      // was up to twenty seconds away: the app sat cut off and silent.
      this.connectivity.markFailure(breakerFailure);
      this.connectivity.probe();
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
        catchError((err: unknown) => throwError(() => normalizeError(err, url))),
      );

    let settled = false;
    const settle = (failure: ApiFailure | null): void => {
      if (settled) return;
      settled = true;
      if (failure) {
        this.breaker.failure();
        this.connectivity.markFailure(failure);
      } else {
        this.breaker.success();
        this.connectivity.markSuccess();
      }
    };

    return once().pipe(
      tap(() => settle(null)),
      retry({
        count: attempts,
        delay: (error: unknown, retryCount: number) => {
          const failure = isApiFailure(error) ? error : normalizeError(error, url);
          // Unretryable failures surface immediately; retryable ones wait out
          // the jitter without touching the breaker — only the final outcome
          // of the request counts.
          if (!failure.retryable || attempts === 0) return throwError(() => failure);
          // A retry only helps when the blip was isolated to this call. The
          // storefront opens ~9 independent GETs on startup, so a backend that
          // is merely saturated makes every one of them hit the same timeout at
          // the same instant. Retrying each on its own then doubles the queue on
          // the six HTTP/1.1 sockets the origin is allowed and pushes the error
          // state from ten seconds to twenty — the reported "pending, then it
          // fails". If another request already failed transport-wise while this
          // one was in flight, the server is the problem, so surface it now and
          // let the banner's Retry be the human-gated second chance.
          if (this.retriesIssued - ownRetries > retriesAtStart) return throwError(() => failure);
          this.retriesIssued += 1;
          ownRetries += 1;
          const base = 300 * 2 ** Math.max(0, retryCount - 1);
          const jitter = Math.floor(Math.random() * 200);
          return timer(base + jitter);
        },
      }),
      timeout({
        each: totalMs,
        with: () => throwError(() => new ApiFailure({
          status: 0,
          kind: 'timeout',
          retryable: true,
          messageKey: 'resilience.timeoutTitle',
          requestId: newRequestId(),
          detail: `request exceeded ${totalMs} ms across retries`,
          url,
        })),
      }),
      catchError((err: unknown) => {
        const failure = isApiFailure(err) ? err : normalizeError(err, url);
        settle(failure);
        return throwError(() => failure);
      }),
      // A probe the caller abandons (navigation away) must hand the slot back,
      // or the breaker would stay shut with nobody allowed to test the backend.
      // Cancellation deliberately records no health outcome either way.
      gate === 'probe' ? finalize(() => this.breaker.releaseProbe()) : (s: Observable<T>) => s,
    );
  }
}
