import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConnectivityService } from '../resilience/connectivity.service';
import { ApiClientService } from './api-client.service';

const BASE = environment.apiBaseUrl.replace(/\/$/, '');

function connectivityStub() {
  return {
    markSuccess: jasmine.createSpy('markSuccess'),
    markFailure: jasmine.createSpy('markFailure'),
    status: signal<'online' | 'degraded' | 'offline'>('online'),
    recovered$: new Subject<void>(),
    probe: jasmine.createSpy('probe'),
  };
}

describe('ApiClientService resilience', () => {
  let service: ApiClientService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConnectivityService, useValue: connectivityStub() },
      ],
    });
    service = TestBed.inject(ApiClientService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('retries a retryable GET twice with backoff, then succeeds', fakeAsync(() => {
    let value: unknown;
    let error: unknown;
    service.get('catalog', undefined, { retryAttempts: 2, timeoutMs: 5000 }).subscribe({
      next: (v) => (value = v),
      error: (e) => (error = e),
    });

    httpMock.expectOne(`${BASE}/catalog`).flush({}, { status: 503, statusText: 'Unavailable' });
    tick(1000);
    httpMock.expectOne(`${BASE}/catalog`).flush({}, { status: 503, statusText: 'Unavailable' });
    tick(2000);
    httpMock.expectOne(`${BASE}/catalog`).flush({ ok: true });

    expect(error).toBeUndefined();
    expect(value).toEqual({ ok: true });
  }));

  it('does not retry a 404', fakeAsync(() => {
    let error: { kind?: string } | undefined;
    service.get('missing', undefined, { retryAttempts: 2 }).subscribe({ error: (e) => (error = e) });
    httpMock.expectOne(`${BASE}/missing`).flush({}, { status: 404, statusText: 'Not Found' });
    tick(2000);
    httpMock.expectNone(`${BASE}/missing`);
    expect(error?.kind).toBe('not_found');
  }));

  it('never retries a mutation', fakeAsync(() => {
    let error: { kind?: string } | undefined;
    service.post('orders', { id: 1 }, undefined, { retryAttempts: 2 }).subscribe({ error: (e) => (error = e) });
    httpMock.expectOne(`${BASE}/orders`).flush({}, { status: 503, statusText: 'Unavailable' });
    tick(2000);
    httpMock.expectNone(`${BASE}/orders`);
    expect(error?.kind).toBe('server');
  }));

  it('turns a hung request into a timeout at the configured budget', fakeAsync(() => {
    let error: { kind?: string } | undefined;
    service.get('slow', undefined, { timeoutMs: 1000, retryAttempts: 0 }).subscribe({ error: (e) => (error = e) });
    const request = httpMock.expectOne(`${BASE}/slow`);
    tick(1001);
    expect(error?.kind).toBe('timeout');
    // Resolve the orphaned testing request so verify() sees a settled backend.\r\n    try { request.flush({}); } catch { /* already settled */ }
  }));

  it('opens the circuit breaker after five transport failures', fakeAsync(() => {
    for (let i = 0; i < 5; i += 1) {
      service.get(`broken-${i}`, undefined, { retryAttempts: 0 }).subscribe({ error: () => {} });
      httpMock.expectOne(`${BASE}/broken-${i}`).error(new ProgressEvent('error'));
    }
    let error: { kind?: string } | undefined;
    service.get('after-breaker', undefined, { retryAttempts: 0 }).subscribe({ error: (e) => (error = e) });
    httpMock.expectNone(`${BASE}/after-breaker`);
    expect(error?.kind).toBe('network');
  }));

  it('coalesces concurrent identical GETs into one request', () => {
    const seen: unknown[] = [];
    service.get('shared').subscribe((v) => seen.push(v));
    service.get('shared').subscribe((v) => seen.push(v));
    httpMock.expectOne(`${BASE}/shared`).flush({ ok: 1 });
    expect(seen.length).toBe(2);
    expect(seen[0]).toEqual({ ok: 1 });
  });

  it('getSafe falls back on a wrong shape without throwing', () => {
    let value: string[] | undefined;
    service
      .getSafe<string[]>(
        'categories',
        undefined,
        (raw) => {
          const items = (raw as { items?: unknown }).items;
          if (!Array.isArray(items)) throw new Error('bad shape');
          return items as string[];
        },
        () => ['fallback'],
      )
      .subscribe((v) => (value = v));
    httpMock.expectOne(`${BASE}/categories`).flush({ items: 'not-an-array' });
    expect(value).toEqual(['fallback']);
  });
});
