import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { MessageService } from 'primeng/api';
import { CatalogPageComponent } from './catalog-page.component';
import { CurrencyService } from '../../core/services/currency.service';
import { environment } from '../../../environments/environment';

/** Reference snapshot shape the storefront validates against (EUR base). */
const RATES = {
  baseCurrency: 'EUR' as const,
  date: '2026-10-20',
  source: 'spec',
  rates: { EUR: 1, EGP: 60.276, USD: 1.1235, CZK: 24.335 },
};

const EMPTY_PAGE = { items: [], total: 0 };

type Query = { maxPrice?: number };

describe('CatalogPageComponent price filter (selected-currency native)', () => {
  // Longer default timeout for this suite to accommodate router + async cycles.
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;
  let harness: RouterTestingHarness;
  let fixture: ComponentFixture<CatalogPageComponent>;
  let backend: HttpTestingController;
  let router: Router;
  let originalUseMockApi: boolean;

  beforeEach(async () => {
    localStorage.clear();
    // This suite asserts the LIVE contract (the visitor's price bound travels
    // to the server converted to USD), so it must not run in mock mode — the
    // same opt-in the other live-mode suites use.
    originalUseMockApi = environment.useMockApi;
    environment.useMockApi = false;
    TestBed.configureTestingModule({
      providers: [
        MessageService,
        provideRouter([{ path: 'products', component: CatalogPageComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    environment.useMockApi = originalUseMockApi;
    // The suite stores a currency; it must not leak into the next spec file
    // (a persisted currency changes what other suites resolve).
    localStorage.removeItem('novamart.currency');
    backend.verify();
  });

  function flushRates(): void {
    backend.expectOne((r) => r.url.endsWith('/exchange-rates')).flush(RATES);
  }

  /**
   * Answers the catalogue's price range. The API owns the real ceiling of the
   * active catalogue, so the page asks for it before it can bound the price
   * filter.
   */
  function flushPriceRange(maxPrice = 120): void {
    for (const req of backend.match((r) => r.url.endsWith('/products/price-range'))) {
      req.flush({ minPrice: 4, maxPrice, currency: 'USD' });
    }
  }

  /** Consumes the pending catalogue request and returns its maxPrice bound (null = unbounded). */
  function consumeProductMaxPrice(): number | null {
    const req: TestRequest = backend.expectOne((r) => r.url.endsWith('/products'));
    const raw = req.request.params.get('maxPrice');
    req.flush(EMPTY_PAGE);
    return raw === null ? null : Number(raw);
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, evenMore()));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function evenMore(): number {
    // Debounce windows (350 ms) or effect-scheduled work may still be pending.
    return 400;
  }

  async function openCatalog(query = ''): Promise<void> {
    await harness.navigateByUrl(`/products${query}`, CatalogPageComponent);
    fixture = harness.fixture as unknown as ComponentFixture<CatalogPageComponent>;

    // Intercept the initialization requests:
    // 1) exchange-rates (from effect triggered by currency change)
    // 2) categories + price-range (ngOnInit subscriptions)
    // 3) products (the query-param subscription)
    flushRates();
    flushPriceRange();
    backend
      .expectOne((r) => r.url.endsWith('/categories') || r.url.includes('/categories?'))
      .flush([]);
    backend.expectOne((r) => r.url.endsWith('/products')).flush(EMPTY_PAGE);
    await settle();
  }

  const chipTexts = (): string[] =>
    Array.from(fixture.nativeElement.querySelectorAll('p-chip')).map((el: unknown) =>
      (el as HTMLElement).textContent?.trim() ?? '',
    );

  // The harness fixture is the ROOT component (the one with the router
  // outlet), so the page under test is reached through its own debug element.
  const page = (): CatalogPageComponent =>
    harness.fixture.debugElement.query(By.directive(CatalogPageComponent)).componentInstance as CatalogPageComponent;

  // The currency service reads the persisted currency when it is FIRST
  // created, so it must not be instantiated before the test stores one.
  const currencyService = (): CurrencyService => TestBed.inject(CurrencyService);

  const appliedQuery = (): Query =>
    (page() as unknown as { currentQuery(): Query }).currentQuery();

  it('interprets typed numbers in the selected currency end to end', async () => {
    localStorage.setItem('novamart.currency', 'EGP');
    await openCatalog('?max=200');

    // The URL bound 200 is read in the visitor's currency (EGP) and shipped to
    // the server's USD contract converted: 200 EGP ≈ 3.73 USD.
    const applied = appliedQuery().maxPrice ?? 0;
    expect(applied).toBeGreaterThan(3.7);
    expect(applied).toBeLessThan(3.75);

    // The chip speaks the visitor's currency, exactly what was typed.
    const maxChip = chipTexts().find((t) => t.startsWith('≤'));
    expect(maxChip ?? '').toContain('200');

    // Typing 2 means 2 EGP — the applied USD bound drops accordingly.
    (page() as unknown as { onPriceInput(b: 'max', v: number): void }).onPriceInput('max', 2);
    await settle();

    const bound = consumeProductMaxPrice();
    expect(bound ?? 1).toBeGreaterThan(0.036);
    expect(bound ?? 1).toBeLessThan(0.039);
    expect(chipTexts().find((t) => t.startsWith('≤'))).toContain('2');
    expect(router.url).toContain('max=2');
  });

  it('bounds the price filter with the catalogue ceiling the API reports', async () => {
    localStorage.setItem('novamart.currency', 'USD');
    await harness.navigateByUrl('/products', CatalogPageComponent);
    fixture = harness.fixture as unknown as ComponentFixture<CatalogPageComponent>;
    // The catalogue's most expensive product costs 480 USD.
    flushPriceRange(480);
    backend
      .expectOne((r) => r.url.endsWith('/categories') || r.url.includes('/categories?'))
      .flush([]);
    backend.expectOne((r) => r.url.endsWith('/products')).flush(EMPTY_PAGE);
    await settle();

    // The ceiling follows the API (rounded up to a whole 10), NOT the price
    // of the demo catalogue that ships with the frontend.
    const limit = (page() as unknown as { displayPriceLimit(): number }).displayPriceLimit();
    expect(limit).toBe(480);

    // A bound below the ceiling is applied as typed.
    (page() as unknown as { onPriceInput(b: 'max', v: number): void }).onPriceInput('max', 200);
    await settle();

    expect(consumeProductMaxPrice()).toBe(200);
    expect(appliedQuery().maxPrice).toBe(200);
  });

  it('clears the upper bound when its chip is removed', async () => {
    localStorage.setItem('novamart.currency', 'EGP');
    await openCatalog('?max=200');

    (page() as unknown as { removeChip(key: string): void }).removeChip('max');
    await settle();

    expect(consumeProductMaxPrice()).toBeNull();
    expect(chipTexts().some((t) => t.startsWith('≤'))).toBeFalse();
    expect(appliedQuery().maxPrice).toBeUndefined();
    expect(router.url).not.toContain('max=');
  });

  it('treats a beyond-ceiling value as no upper bound', async () => {
    localStorage.setItem('novamart.currency', 'EGP');
    await openCatalog('?max=200');

    // Nothing left to filter at the catalog ceiling: the bound disappears, so
    // the server is asked for the whole catalogue again, and the echoed field
    // shows the ceiling instead of the typed number.
    (page() as unknown as { onPriceInput(b: 'max', v: number): void }).onPriceInput('max', 999999);
    await settle();

    expect(consumeProductMaxPrice()).toBeNull();
    expect(chipTexts().some((t) => t.startsWith('≤'))).toBeFalse();
    expect(appliedQuery().maxPrice).toBeUndefined();
  });

  it('keeps the bound meaning when the visitor switches currency', async () => {
    localStorage.setItem('novamart.currency', 'EGP');
    await openCatalog('?max=200');

    const before = appliedQuery().maxPrice ?? 0;

    currencyService().setCurrency('USD');
    await settle();

    // Same "≤ 200 EGP-worth" meaning, re-expressed in the new currency.
    const after = appliedQuery().maxPrice ?? 0;
    expect(after).toBeCloseTo(before, 2);
    expect(chipTexts().find((t) => t.startsWith('≤'))).toContain('3.7');
    // The re-expressed bound is applied, so the list is loaded with it.
    expect(consumeProductMaxPrice()).toBeCloseTo(before, 2);
  });
});