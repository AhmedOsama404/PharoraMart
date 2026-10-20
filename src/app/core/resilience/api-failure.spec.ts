import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ApiFailure, asArray, asRecord, isApiFailure, normalizeError } from './api-failure';

describe('normalizeError', () => {
  it('classifies transport failures as retryable network errors', () => {
    const failure = normalizeError(new HttpErrorResponse({ status: 0, url: 'https://api.test/x' }));
    expect(failure instanceof ApiFailure).toBe(true);
    expect(failure.kind).toBe('network');
    expect(failure.status).toBe(0);
    expect(failure.retryable).toBe(true);
    expect(failure.messageKey).toBe('resilience.networkTitle');
    expect(failure.requestId).toMatch(/^req-/);
  });

  it('classifies RxJS timeout errors', () => {
    const err = Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    const failure = normalizeError(err);
    expect(failure.kind).toBe('timeout');
    expect(failure.retryable).toBe(true);
  });

  it('classifies 5xx as server and only retries gateway/availability statuses', () => {
    expect(normalizeError(new HttpErrorResponse({ status: 500 })).kind).toBe('server');
    expect(normalizeError(new HttpErrorResponse({ status: 500 })).retryable).toBe(false);
    expect(normalizeError(new HttpErrorResponse({ status: 502 })).retryable).toBe(true);
    expect(normalizeError(new HttpErrorResponse({ status: 503 })).retryable).toBe(true);
    expect(normalizeError(new HttpErrorResponse({ status: 504 })).retryable).toBe(true);
  });

  it('classifies auth and client statuses without treating them as retryable', () => {
    expect(normalizeError(new HttpErrorResponse({ status: 401 })).kind).toBe('unauthorized');
    expect(normalizeError(new HttpErrorResponse({ status: 403 })).kind).toBe('forbidden');
    expect(normalizeError(new HttpErrorResponse({ status: 404 })).kind).toBe('not_found');
    expect(normalizeError(new HttpErrorResponse({ status: 422 })).kind).toBe('validation');
    expect(normalizeError(new HttpErrorResponse({ status: 400 })).retryable).toBe(false);
  });

  it('carries Retry-After for 429 without auto-retrying', () => {
    const failure = normalizeError(
      new HttpErrorResponse({ status: 429, headers: new HttpHeaders({ 'Retry-After': '3' }) }),
    );
    expect(failure.kind).toBe('rate_limited');
    expect(failure.retryable).toBe(false);
    expect(failure.retryAfterMs).toBe(3000);
  });

  it('classifies a 200 HTML body as a parse failure, never as success', () => {
    const failure = normalizeError(
      new HttpErrorResponse({ status: 200, error: { error: new SyntaxError('Unexpected token <'), text: '<html>' } }),
    );
    expect(failure.kind).toBe('parse');
    expect(failure.status).toBe(200);
    expect(failure.retryable).toBe(false);
  });

  it('uses the backend request id header when present', () => {
    const failure = normalizeError(
      new HttpErrorResponse({ status: 503, headers: new HttpHeaders({ 'X-Request-Id': 'srv-123' }) }),
    );
    expect(failure.requestId).toBe('srv-123');
  });

  it('is idempotent and never throws on garbage', () => {
    const once = normalizeError(new HttpErrorResponse({ status: 500 }));
    expect(normalizeError(once)).toBe(once);
    expect(normalizeError('boom').kind).toBe('unknown');
    expect(normalizeError(undefined).kind).toBe('unknown');
    expect(isApiFailure(once)).toBe(true);
    expect(isApiFailure({ kind: 'server' })).toBe(false);
  });
});

describe('shape helpers', () => {
  it('asArray filters non-array bodies and null entries', () => {
    expect(asArray({ items: [] })).toEqual([]);
    expect(asArray([{ id: 1 }, null, { id: 2 }])).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('asRecord never throws and never returns an array', () => {
    expect(asRecord(null)).toEqual({});
    expect(asRecord([1, 2])).toEqual({});
    expect(asRecord({ id: 1 })).toEqual({ id: 1 });
  });
});
