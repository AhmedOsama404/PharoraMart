import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject, finalize, of, throwError, type Observable } from 'rxjs';
import { ProductDetailPageComponent } from './product-detail-page.component';
import { ProductService } from '../../core/services/product.service';
import { NotificationService } from '../../core/services/notification.service';
import { ScrollService } from '../../core/services/scroll.service';
import { MOCK_PRODUCTS } from '../../data-access/mock-data';
import type { Category, Product } from '../../models/product.model';

const A = MOCK_PRODUCTS[0];
const B = MOCK_PRODUCTS[1];
const C = MOCK_PRODUCTS[2];

function text(fixture: ComponentFixture<unknown>, selector: string): string | null {
  return fixture.nativeElement.querySelector(selector)?.textContent?.trim() ?? null;
}

describe('ProductDetailPageComponent (regression)', () => {
  let harness: RouterTestingHarness;
  let getByIdImpl: (id: string) => Observable<Product>;
  let subjects: Map<string, Subject<Product>>;
  let relatedShouldFail: boolean;

  const stubProducts = {
    getById: (id: string) => getByIdImpl(id),
    related: () => {
      if (relatedShouldFail) return throwError(() => new Error('related-down'));
      return of([]);
    },
    categoryName: (id: string) => id,
    categoryLabel: (category: Category) => category.name,
    preloadCategories: () => undefined,
  };

  function controllableBackend(): void {
    subjects = new Map();
    let tornDown = 0;
    stubProductsTeardown.count = () => tornDown;
    getByIdImpl = (id: string) => {
      if (id === 'boom') return throwError(() => new Error('boom'));
      if (id === 'null-product') return of(null as unknown as Product);
      const found = MOCK_PRODUCTS.find((p) => p.id === id);
      if (!found) return throwError(() => new Error('not-found'));
      const s = new Subject<Product>();
      subjects.set(id, s);
      return s.pipe(finalize(() => tornDown++));
    };
  }

  const stubProductsTeardown = { count: () => 0 };

  beforeEach(async () => {
    localStorage.clear();
    relatedShouldFail = false;
    controllableBackend();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'products/:id', component: ProductDetailPageComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ProductService, useValue: stubProducts },
        { provide: NotificationService, useValue: { success: () => undefined, error: () => undefined } },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  it('shows the skeleton while the product request is pending', async () => {
    await harness.navigateByUrl(`/products/${A.id}`, ProductDetailPageComponent);
    const fixture = harness.fixture;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('p-skeleton')).toBeTruthy();
  });

  it('displays the product after a successful response', async () => {
    await harness.navigateByUrl(`/products/${A.id}`, ProductDetailPageComponent);
    const fixture = harness.fixture;
    subjects.get(A.id)?.next(A);
    fixture.detectChanges();
    expect(text(fixture, 'h1')).toContain(A.name);
    expect(fixture.nativeElement.querySelector('p-skeleton')).toBeFalsy();
  });

  it('shows the not-found state for an unknown product', async () => {
    await harness.navigateByUrl('/products/no-such-product', ProductDetailPageComponent);
    const fixture = harness.fixture;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('p-skeleton')).toBeFalsy();
  });

  it('treats a blank id as not-found without issuing a request', async () => {
    const calls: string[] = [];
    const prev = getByIdImpl;
    getByIdImpl = (id: string) => {
      calls.push(id);
      return prev(id);
    };
    await harness.navigateByUrl('/products/%20', ProductDetailPageComponent);
    const fixture = harness.fixture;
    fixture.detectChanges();
    expect(calls).not.toContain('');
    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
  });

  it('never hangs when the request completes without a valid product', async () => {
    await harness.navigateByUrl('/products/null-product', ProductDetailPageComponent);
    const fixture = harness.fixture;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('p-skeleton')).toBeFalsy();
  });

  it('shows an error state with a working retry after a recoverable failure', async () => {
    const comp = (await harness.navigateByUrl(
      '/products/boom',
      ProductDetailPageComponent,
    )) as unknown as { retry: () => void };
    const fixture = harness.fixture;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
    // Repair the backend, then retry from the UI.
    getByIdImpl = (id: string) => {
      const s = new Subject<Product>();
      subjects.set(id, s);
      return s;
    };
    let retryCalls = 0;
    const origRetry = comp.retry.bind(comp);
    comp.retry = () => {
      retryCalls++;
      origRetry();
    };
    // Drive retry through the app-owned template binding
    // (empty-state actionClick → page retry). Native p-button clicks are
    // covered separately: PrimeNG internals plus a real-browser click probe.
    const emptyState = fixture.debugElement.query(By.css('app-empty-state'));
    expect(emptyState).toBeTruthy();
    emptyState.triggerEventHandler('actionClick', null);
    fixture.detectChanges();
    expect(retryCalls).toBe(1);
    expect(subjects.has('boom')).toBeTrue();
    subjects.get('boom')?.next(A);
    fixture.detectChanges();
    expect(text(fixture, 'h1')).toContain(A.name);
  });

  it('cancels the superseded request: no stale data on rapid navigation', async () => {
    await harness.navigateByUrl(`/products/${A.id}`, ProductDetailPageComponent);
    const fixture = harness.fixture;
    fixture.detectChanges();
    // Navigate away while A's request is still in flight.
    await harness.navigateByUrl(`/products/${B.id}`, ProductDetailPageComponent);
    fixture.detectChanges();
    expect(stubProductsTeardown.count()).toBe(1);
    // A's late response must be ignored.
    subjects.get(A.id)?.next(A);
    fixture.detectChanges();
    expect(text(fixture, 'h1')).not.toContain(A.name);
    subjects.get(B.id)?.next(B);
    fixture.detectChanges();
    expect(text(fixture, 'h1')).toContain(B.name);
  });

  it('still renders the product when related-products fail', async () => {
    relatedShouldFail = true;
    await harness.navigateByUrl(`/products/${A.id}`, ProductDetailPageComponent);
    const fixture = harness.fixture;
    subjects.get(A.id)?.next(A);
    fixture.detectChanges();
    expect(text(fixture, 'h1')).toContain(A.name);
  });

  it('keeps the breadcrumb model referentially stable across change detection', async () => {
    const comp = (await harness.navigateByUrl(
      `/products/${A.id}`,
      ProductDetailPageComponent,
    )) as unknown as { crumbs: () => unknown };
    const fixture = harness.fixture;
    subjects.get(A.id)?.next(A);
    fixture.detectChanges();
    const first = comp.crumbs();
    fixture.detectChanges();
    fixture.detectChanges();
    // Same reference → PrimeNG inputs see no change → no render loop.
    expect(comp.crumbs()).toBe(first);
  });

  it('renders framed image placeholders behind gallery images', async () => {
    await harness.navigateByUrl(`/products/${A.id}`, ProductDetailPageComponent);
    const fixture = harness.fixture;
    subjects.get(A.id)?.next(A);
    fixture.detectChanges();
    // The frame owns the aspect box and the placeholder sits behind the img,
    // so a fully failed load degrades to a clean box (never a collapsed sliver).
    expect(fixture.nativeElement.querySelector('.main-frame > img.main')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.main-frame > .img-fallback')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.thumb-frame > .img-fallback').length).toBeGreaterThan(0);
  });

  it('resets the scroll position when navigating to a related product', async () => {
    const scroll = TestBed.inject(ScrollService);
    const spy = spyOn(scroll, 'scrollToTop');
    await harness.navigateByUrl(`/products/${A.id}`, ProductDetailPageComponent);
    const fixture = harness.fixture;
    subjects.get(A.id)?.next(A);
    fixture.detectChanges();
    spy.calls.reset();
    // Same component instance, different product id (related-product click).
    await harness.navigateByUrl(`/products/${B.id}`, ProductDetailPageComponent);
    fixture.detectChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('never presents the old product as the new one during transition', async () => {
    await harness.navigateByUrl(`/products/${A.id}`, ProductDetailPageComponent);
    const fixture = harness.fixture;
    subjects.get(A.id)?.next(A);
    fixture.detectChanges();
    expect(text(fixture, 'h1')).toContain(A.name);
    await harness.navigateByUrl(`/products/${B.id}`, ProductDetailPageComponent);
    fixture.detectChanges();
    // B is still loading: skeleton up, A's content gone — never mismatched.
    expect(fixture.nativeElement.querySelector('p-skeleton')).toBeTruthy();
    expect(text(fixture, 'h1')).not.toContain(A.name);
    subjects.get(B.id)?.next(B);
    fixture.detectChanges();
    expect(text(fixture, 'h1')).toContain(B.name);
  });

  it('lands on the final product after rapid A → B → C navigation', async () => {
    await harness.navigateByUrl(`/products/${A.id}`, ProductDetailPageComponent);
    const fixture = harness.fixture;
    await harness.navigateByUrl(`/products/${B.id}`, ProductDetailPageComponent);
    await harness.navigateByUrl(`/products/${C.id}`, ProductDetailPageComponent);
    fixture.detectChanges();
    subjects.get(C.id)?.next(C);
    fixture.detectChanges();
    expect(text(fixture, 'h1')).toContain(C.name);
    expect(fixture.nativeElement.querySelector('p-skeleton')).toBeFalsy();
  });

  it('reloads the previous product when history returns to its URL', async () => {
    await harness.navigateByUrl(`/products/${A.id}`, ProductDetailPageComponent);
    const fixture = harness.fixture;
    subjects.get(A.id)?.next(A);
    fixture.detectChanges();
    await harness.navigateByUrl(`/products/${B.id}`, ProductDetailPageComponent);
    subjects.get(B.id)?.next(B);
    fixture.detectChanges();
    expect(text(fixture, 'h1')).toContain(B.name);
    // A history pop produces exactly this navigation (same URL, same reused
    // instance): the pipeline must re-request A, never resurrect B's data.
    await harness.navigateByUrl(`/products/${A.id}`, ProductDetailPageComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('p-skeleton')).toBeTruthy();
    subjects.get(A.id)?.next(A);
    fixture.detectChanges();
    expect(text(fixture, 'h1')).toContain(A.name);
  });
});
