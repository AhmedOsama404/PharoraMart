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
  const recoverHooks: Array<() => void> = [];
  return {
    markSuccess: jasmine.createSpy('markSuccess'),
    markFailure: jasmine.createSpy('markFailure'),
    status: signal<'online' | 'degraded' | 'offline'>('online'),
    recovered$: new Subject<void>(),
    probe: jasmine.createSpy('probe'),
    onRetry: jasmine.createSpy('onRetry'),
    onRecover: jasmine.createSpy('onRecover').and.callFake((hook: () => void) => recoverHooks.push(hook)),
    /** Fires the recovery hooks the way ConnectivityService.markSuccess does. */
    emitRecovery: () => recoverHooks.forEach((hook) => hook()),
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

  it('does not spend a retry on every request when the backend fails them all', fakeAsync(() => {
    // The storefront opens ~9 independent GETs at startup, so a saturated
    // backend times every one of them out in the same instant. Only one of the
    // pair may retry; the rest must surface immediately instead of doubling the
    // queue on the six sockets this origin is allowed.
    const surfaced: Array<{ kind?: string }> = [];
    service.get('feed-a', undefined, { retryAttempts: 2, timeoutMs: 5000 }).subscribe({
      error: (e) => surfaced.push(e as { kind?: string }),
    });
    service.get('feed-b', undefined, { retryAttempts: 2, timeoutMs: 5000 }).subscribe({
      error: (e) => surfaced.push(e as { kind?: string }),
    });

    httpMock.expectOne(`${BASE}/feed-a`).flush({}, { status: 503, statusText: 'Unavailable' });
    httpMock.expectOne(`${BASE}/feed-b`).flush({}, { status: 503, statusText: 'Unavailable' });

    tick(2000);
    // Which sibling keeps its retry is not deterministic, so assert the budget
    // rather than the identity: one request re-issued, one failed fast.
    const stillOpen = httpMock.match(() => true);
    expect(stillOpen.length).toBe(1);
    expect(surfaced.length).toBe(1);
    expect(surfaced[0].kind).toBe('server');

    stillOpen[0].flush({ ok: true });
    tick(1000);
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

  /**
   * The breaker reads the wall clock to decide whether failures are one
   * incident or several, so a spec that wants separate incidents has to move
   * it. RxJS timers keep running on the fake-async clock untouched.
   */
  function fakeClock(): { advance: (ms: number) => void } {
    let offset = 0;
    const realNow = Date.now.bind(Date);
    spyOn(Date, 'now').and.callFake(() => realNow() + offset);
    return { advance: (ms: number) => (offset += ms) };
  }

  /** Drive `bursts` failure incidents, spaced past the breaker's incident window. */
  function openBreaker(bursts: number): { advance: (ms: number) => void } {
    const clock = fakeClock();
    for (let i = 0; i < bursts; i += 1) {
      service.get(`down-${i}`, undefined, { retryAttempts: 0 }).subscribe({ error: () => {} });
      httpMock.expectOne(`${BASE}/down-${i}`).error(new ProgressEvent('error'));
      clock.advance(2_100);
    }
    return clock;
  }

  it('opens the circuit breaker after five separate failure bursts', () => {
    openBreaker(5);
    let error: { kind?: string } | undefined;
    service.get('after-breaker', undefined, { retryAttempts: 0 }).subscribe({ error: (e) => (error = e) });
    httpMock.expectNone(`${BASE}/after-breaker`);
    expect(error?.kind).toBe('network');
  });

  it('keeps reaching the backend when a whole startup fan-out fails at one instant', () => {
    // The catalog, header, cart and home screens open ~9 independent GETs
    // together. A saturated-but-alive server times all of them out in the same
    // instant; that is ONE verdict, so it must not be enough to cut the visitor
    // off from a backend that still answers.
    for (let i = 0; i < 8; i += 1) {
      service.get(`burst-${i}`, undefined, { retryAttempts: 0 }).subscribe({ error: () => {} });
    }
    for (let i = 0; i < 8; i += 1) {
      httpMock.expectOne(`${BASE}/burst-${i}`).error(new ProgressEvent('error'));
    }
    let value: unknown;
    service.get('after-burst', undefined, { retryAttempts: 0 }).subscribe({ next: (v) => (value = v) });
    httpMock.expectOne(`${BASE}/after-burst`).flush({ ok: true });
    expect(value).toEqual({ ok: true });
  });

  it('reports a gated request and re-checks the server without extending its own cooldown', () => {
    const connectivity = TestBed.inject(ConnectivityService) as unknown as {
      markFailure: jasmine.Spy;
      probe: jasmine.Spy;
    };
    const clock = openBreaker(5);
    const markFailureBefore = connectivity.markFailure.calls.count();

    // Still inside the cooldown: the request is refused locally.
    clock.advance(8_000);
    service.get('while-open', undefined, { retryAttempts: 0 }).subscribe({ error: () => {} });
    httpMock.expectNone(`${BASE}/while-open`);

    // A refusal the client made itself is not evidence about the server, so it
    // must not push the cooldown out. If it did, every attempt while the breaker
    // was open would postpone the one moment the app is allowed to test the
    // backend, and the outage would keep itself alive.
    clock.advance(6_000);
    let value: unknown;
    service.get('after-cooldown', undefined, { retryAttempts: 0 }).subscribe({ next: (v) => (value = v) });
    httpMock.expectOne(`${BASE}/after-cooldown`).flush({ ok: true });
    expect(value).toEqual({ ok: true });

    // But it is evidence about the app: the shopper saw a blocked request, so
    // the state must say so and the one check that can clear it must run now
    // rather than on the next interval tick.
    expect(connectivity.markFailure.calls.count()).toBeGreaterThan(markFailureBefore);
    expect(connectivity.probe.calls.count()).toBeGreaterThan(0);
  });

  it('releases the breaker when a probe proves the backend is reachable again', () => {
    const connectivity = TestBed.inject(ConnectivityService) as unknown as { emitRecovery: () => void };
    openBreaker(5);
    // Gated while the breaker is open.
    service.get('while-open', undefined, { retryAttempts: 0 }).subscribe({ error: () => {} });
    httpMock.expectNone(`${BASE}/while-open`);

    // The liveness probe is a raw fetch, so only the recovery hook can reopen
    // the gate. Without it every `recovered$` refetch stays rejected.
    connectivity.emitRecovery();

    let value: unknown;
    service.get('after-recovery', undefined, { retryAttempts: 0 }).subscribe({ next: (v) => (value = v) });
    httpMock.expectOne(`${BASE}/after-recovery`).flush({ ok: true });
    expect(value).toEqual({ ok: true });
  });

  it('counts one breaker failure per request, not per retry attempt', fakeAsync(() => {
    // Three attempts of ONE stalled GET must not consume most of the budget:
    // that is what let two slow requests open the circuit against a healthy
    // backend and fail everything for the whole cooldown.
    for (let i = 0; i < 3; i += 1) {
      service.get(`flaky-${i}`, undefined, { retryAttempts: 2 }).subscribe({ error: () => {} });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        httpMock.expectOne(`${BASE}/flaky-${i}`).error(new ProgressEvent('error'));
        tick(2000);
      }
    }
    let value: unknown;
    service.get('still-allowed', undefined, { retryAttempts: 0 }).subscribe({ next: (v) => (value = v) });
    httpMock.expectOne(`${BASE}/still-allowed`).flush({ ok: true });
    expect(value).toEqual({ ok: true });
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
