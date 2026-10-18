import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, forkJoin } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiClientService } from './api-client.service';

// Verifies the centralized HTTP boundary: base URL resolution, query/array
// serialization, and pass-through of per-request headers (Idempotency-Key).
describe('ApiClientService', () => {
  let service: ApiClientService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiClientService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('prefixes the configured base URL', () => {
    service.get('/products').subscribe();
    const req = httpMock.expectOne((r) => r.url.includes('/products'));
    expect(req.request.url).toBe(environment.apiBaseUrl.replace(/\/$/, '') + '/products');
    req.flush({});
  });

  it('serializes array params as repeated keys and skips null/undefined', () => {
    service.get('products', { q: 'abc', tags: ['a', 'b'], onSale: true, page: 2, minPrice: null }).subscribe();
    const req = httpMock.expectOne((r) => r.url.includes('/products'));
    const params = req.request.params;
    expect(params.getAll('tags')).toEqual(['a', 'b']);
    expect(params.get('q')).toBe('abc');
    expect(params.get('onSale')).toBe('true');
    expect(params.get('page')).toBe('2');
    expect(params.has('minPrice')).toBeFalse();
    req.flush({});
  });

  it('passes per-request headers through (Idempotency-Key)', () => {
    service.post('orders', { total: 1 }, { 'Idempotency-Key': 'ck-123' }).subscribe();
    const req = httpMock.expectOne((r) => r.url.includes('/orders'));
    expect(req.request.headers.get('Idempotency-Key')).toBe('ck-123');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });
});

/**
 * Guards the request-coalescing contract: two subscribers asking for the same
 * resource while the first request is still open must share ONE HTTP call, and
 * every later call must still hit the network (no stale-data caching).
 *
 * Regression origin: the checkout page constructor requested `hotels` twice
 * (`hotels()` plus `cities()` which delegates to `hotels()`), i.e. 2 API calls
 * for 1 resource on every checkout page load.
 */
describe('ApiClientService in-flight GET dedup', () => {
  let api: ApiClientService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ApiClientService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('coalesces two concurrent identical GETs into one request', async () => {
    const a$ = firstValueFrom(api.get<{ ok: boolean }>('hotels'));
    const b$ = firstValueFrom(api.get<{ ok: boolean }>('hotels'));

    // Exactly one request must have been issued for the pair.
    const reqs = http.match((r) => r.url.endsWith('/hotels'));
    expect(reqs.length).toBe(1);
    reqs[0].flush({ ok: true });

    expect(await a$).toEqual({ ok: true });
    expect(await b$).toEqual({ ok: true });
  });

  it('coalesces two subscribers of the same query-param GET', async () => {
    const pair = forkJoin([
      api.get<number[]>('products', { page: 1, pageSize: 12 }),
      api.get<number[]>('products', { page: 1, pageSize: 12 }),
    ]);
    const reqs = http.match((r) => r.url.endsWith('/products'));
    expect(reqs.length).toBe(1);
    reqs[0].flush([1, 2, 3]);
    expect(await firstValueFrom(pair)).toEqual([
      [1, 2, 3],
      [1, 2, 3],
    ]);
  });

  it('does NOT reuse a completed request (no stale-data cache)', async () => {
    const first$ = firstValueFrom(api.get<{ n: number }>('products'));
    http.expectOne((r) => r.url.endsWith('/products')).flush({ n: 1 });
    expect(await first$).toEqual({ n: 1 });

    const second$ = firstValueFrom(api.get<{ n: number }>('products'));
    http.expectOne((r) => r.url.endsWith('/products')).flush({ n: 2 });
    expect(await second$).toEqual({ n: 2 });
  });

  it('does not coalesce different resources or different query strings', async () => {
    const a$ = firstValueFrom(api.get('products', { page: 1 }));
    const b$ = firstValueFrom(api.get('products', { page: 2 }));
    const c$ = firstValueFrom(api.get('categories'));

    const reqs = http.match(() => true);
    expect(reqs.length).toBe(3);
    for (const r of reqs) r.flush({});
    await Promise.all([a$, b$, c$]);
  });

  it('clears the in-flight entry after an error so the next call can retry', async () => {
    const failed$ = firstValueFrom(api.get('products', { page: 1 })).catch(() => 'err');
    http.expectOne((r) => r.url.endsWith('/products')).flush(null, {
      status: 500,
      statusText: 'Server Error',
    });
    expect(await failed$).toBe('err');

    const retry$ = firstValueFrom(api.get('products', { page: 1 }));
    http.expectOne((r) => r.url.endsWith('/products')).flush({ ok: true });
    expect(await retry$).toEqual({ ok: true });
  });
});
