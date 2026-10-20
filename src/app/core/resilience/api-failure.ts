import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';

/** Stable failure classes shared by every surface in the app. */
export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'offline'
  | 'server'
  | 'rate_limited'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'parse'
  | 'unknown';

export interface ApiFailureInit {
  readonly status: number;
  readonly kind: ApiErrorKind;
  readonly retryable: boolean;
  readonly messageKey: string;
  readonly requestId: string;
  readonly detail?: string;
  readonly retryAfterMs?: number;
  readonly url?: string | null;
  readonly error?: unknown;
  readonly headers?: HttpHeaders;
}

/**
 * A classified HTTP failure. It deliberately extends `HttpErrorResponse` so
 * existing status-based call sites keep working while new code can branch on
 * `kind` and show the right friendly state.
 */
export class ApiFailure extends HttpErrorResponse {
  readonly kind: ApiErrorKind;
  readonly retryable: boolean;
  readonly messageKey: string;
  readonly requestId: string;
  readonly retryAfterMs?: number;

  constructor(init: ApiFailureInit) {
    super({
      status: init.status,
      statusText: kindLabel(init.kind),
      url: init.url ?? undefined,
      error: init.error ?? null,
      headers: init.headers ?? new HttpHeaders(),
    });
    this.kind = init.kind;
    this.retryable = init.retryable;
    this.messageKey = init.messageKey;
    this.requestId = init.requestId;
    this.retryAfterMs = init.retryAfterMs;
    if (init.detail) {
      // `detail` is for diagnostics only; never rendered by the UI.
      (this as { detail?: string }).detail = init.detail;
    }
  }
}

export function isApiFailure(value: unknown): value is ApiFailure {
  return value instanceof ApiFailure;
}

/** Short, copyable support reference. Never contains user data. */
export function newRequestId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `req-${Date.now().toString(36)}-${rand}`;
}

function kindLabel(kind: ApiErrorKind): string {
  return kind.replace(/_/g, ' ');
}

function requestIdOf(err: HttpErrorResponse, body: unknown): string {
  const header = err.headers?.get('x-request-id') ?? err.headers?.get('x-correlation-id');
  if (header && header.trim()) return header.trim().slice(0, 80);
  if (body && typeof body === 'object') {
    const bag = body as Record<string, unknown>;
    for (const key of ['traceId', 'requestId', 'correlationId']) {
      const value = bag[key];
      if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 80);
    }
  }
  return newRequestId();
}

function retryAfterMs(err: HttpErrorResponse): number | undefined {
  const raw = err.headers?.get('retry-after');
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds, 300) * 1000;
  const at = Date.parse(raw);
  return Number.isFinite(at) ? Math.max(0, Math.min(at - Date.now(), 300_000)) : undefined;
}

/**
 * Convert anything thrown by a data layer into an `ApiFailure`.
 * Never throws, never reads a server prose message for display.
 */
export function normalizeError(err: unknown, fallbackUrl?: string): ApiFailure {
  if (isApiFailure(err)) return err;

  const name = err && typeof err === 'object' ? (err as { name?: string }).name : undefined;
  if (name === 'TimeoutError' || name === 'AbortError') {
    return new ApiFailure({
      status: 0,
      kind: 'timeout',
      retryable: true,
      messageKey: 'resilience.timeoutTitle',
      requestId: newRequestId(),
      url: fallbackUrl ?? null,
    });
  }

  if (err instanceof HttpErrorResponse) {
    const status = err.status;
    const body = err.error;
    const id = requestIdOf(err, body);
    const detail =
      body && typeof body === 'object' && typeof (body as { detail?: unknown }).detail === 'string'
        ? (body as { detail: string }).detail.slice(0, 500)
        : undefined;

    // Angular wraps an unparsable 2xx JSON body as
    // `{ error: SyntaxError, text: '<html>…' }` while keeping status 200.
    const parseLike =
      status >= 200 &&
      status < 300 &&
      (typeof body === 'string' ||
        (body !== null &&
          typeof body === 'object' &&
          (body as { error?: unknown }).error instanceof SyntaxError));

    if (parseLike) {
      return new ApiFailure({
        status,
        kind: 'parse',
        retryable: false,
        messageKey: 'resilience.genericTitle',
        requestId: id,
        detail,
        url: err.url ?? fallbackUrl ?? null,
        error: body,
        headers: err.headers,
      });
    }

    if (status === 0) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      return new ApiFailure({
        status: 0,
        kind: offline ? 'offline' : 'network',
        retryable: true,
        messageKey: offline ? 'resilience.offlineTitle' : 'resilience.networkTitle',
        requestId: id,
        detail,
        url: err.url ?? fallbackUrl ?? null,
        error: body,
        headers: err.headers,
      });
    }

    const kind: ApiErrorKind =
      status === 401 ? 'unauthorized'
        : status === 403 ? 'forbidden'
          : status === 404 ? 'not_found'
            : status === 429 ? 'rate_limited'
              : status === 400 || status === 409 || status === 422 ? 'validation'
                : status >= 500 ? 'server'
                  : 'unknown';

    const messageKey =
      kind === 'unauthorized' ? 'resilience.unauthorizedTitle'
        : kind === 'forbidden' ? 'resilience.forbiddenTitle'
          : kind === 'not_found' ? 'resilience.notFoundTitle'
            : kind === 'rate_limited' ? 'resilience.rateTitle'
              : kind === 'validation' ? 'resilience.validationTitle'
                : kind === 'server' ? 'resilience.serverTitle'
                  : 'resilience.genericTitle';

    return new ApiFailure({
      status,
      kind,
      retryable: status === 408 || status === 425 || status === 502 || status === 503 || status === 504,
      messageKey,
      requestId: id,
      detail,
      retryAfterMs: kind === 'rate_limited' ? retryAfterMs(err) : undefined,
      url: err.url ?? fallbackUrl ?? null,
      error: body,
      headers: err.headers,
    });
  }

  const parseLike = err instanceof SyntaxError || name === 'SyntaxError';
  return new ApiFailure({
    status: 0,
    kind: parseLike ? 'parse' : 'unknown',
    retryable: false,
    messageKey: 'resilience.genericTitle',
    requestId: newRequestId(),
    detail: err instanceof Error ? err.message.slice(0, 500) : undefined,
    url: fallbackUrl ?? null,
  });
}

/** Read a JSON body defensively. One bad field must not blank a page. */
export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asArray<T>(value: unknown, guard?: (item: unknown) => item is T): T[] {
  if (!Array.isArray(value)) return [];
  return guard ? value.filter(guard) : (value.filter((item) => item !== null && item !== undefined) as T[]);
}
