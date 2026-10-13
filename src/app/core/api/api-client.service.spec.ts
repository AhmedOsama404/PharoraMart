import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
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