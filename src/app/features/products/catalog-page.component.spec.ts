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

type Query = { minPrice?: number; maxPrice?: number };

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
    // USD is the bundled base currency, so the service can answer from the
    // built-in rate and never asks for a snapshot; for any other currency the
    // request is there and this flushes it.
    for (const req of backend.match((r) => r.url.endsWith('/exchange-rates'))) {
      req.flush(RATES);
    }
  }

  /**
   * The price filter no longer asks the API for the catalogue's ceiling, so a
   * request to that endpoint must never appear.
   */
  function expectNoPriceRangeRequest(): void {
    backend.expectNone((r) => r.url.endsWith('/products/price-range'));
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
    // 2) categories (ngOnInit subscription)
    // 3) products (the query-param subscription)
    flushRates();
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

  /** The number the visitor actually sees in one of the two price fields. */
  const priceFieldEl = (bound: 'min' | 'max'): HTMLInputElement | null =>
    fixture.nativeElement.querySelector(`#catalog-price-${bound}-panel`) as HTMLInputElement | null;

  const priceFieldValue = (bound: 'min' | 'max'): string => priceFieldEl(bound)?.value ?? '';

  /** The grey suggestion inside an empty price field. */
  const priceFieldPlaceholder = (bound: 'min' | 'max'): string => priceFieldEl(bound)?.placeholder ?? '';

  /** The refusal under the price fields, or '' while the bounds work. */
  const priceErrorMessage = (): string =>
    (fixture.nativeElement.querySelector('.price-msg.is-error') as HTMLElement | null)?.textContent?.trim() ?? '';

  /** The caption under the price fields, which stays empty while nothing is wrong. */
  const priceHint = (): string =>
    (fixture.nativeElement.querySelector('.price-msg:not(.is-error)') as HTMLElement | null)?.textContent?.trim() ?? '';

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

  it('keeps the catalogue ceiling out of the price filter', async () => {
    localStorage.setItem('novamart.currency', 'USD');
    await openCatalog();

    // The filter no longer asks for the catalogue's price range at all, so no
    // number describing "the most expensive product" can reach the form.
    expectNoPriceRangeRequest();
    const body = fixture.nativeElement as HTMLElement;
    expect(priceHint()).toBe('');
    expect(body.querySelector('.price-msg')).toBeNull();
    // The upper field invites an amount instead of naming a limit.
    expect(priceFieldPlaceholder('max')).toBe('No maximum');

    // A bound is applied exactly as typed, ceiling or no ceiling.
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

  it('applies a maximum above every product price exactly as typed', async () => {
    localStorage.setItem('novamart.currency', 'USD');
    await openCatalog('?max=200');
    // A budget above the priciest product is a legitimate question, so the
    // number must survive untouched.
    (page() as unknown as { onPriceInput(b: 'max', v: number): void }).onPriceInput('max', 999999);
    await settle();

    expect(consumeProductMaxPrice()).toBe(999999);
    expect(appliedQuery().maxPrice).toBe(999999);
    // The field keeps what the visitor wrote — it is not snapped back, emptied,
    // or reformatted under the caret.
    expect(priceFieldValue('max')).toBe('999999');
    expect(chipTexts().some((t) => t.includes('999'))).toBeTrue();
    expect(priceErrorMessage()).toBe('');
  });

  it('lets a fraction be typed one character at a time', async () => {
    localStorage.setItem('novamart.currency', 'USD');
    await openCatalog();

    // "0." is the state that made fractions impossible: a `type=number` field
    // reports it as an empty value, so the accessor wrote "0" back over the
    // caret and "0.33" could never be entered. The raw text has to survive.
    (page() as unknown as { onPriceInput(b: 'max', v: string): void }).onPriceInput('max', '0.');
    await settle();
    expect(priceFieldValue('max')).toBe('0.');
    expect(consumeProductMaxPrice()).toBe(0);

    (page() as unknown as { onPriceInput(b: 'max', v: string): void }).onPriceInput('max', '0.33');
    await settle();
    expect(consumeProductMaxPrice()).toBe(0.33);
    expect(priceFieldValue('max')).toBe('0.33');
    expect(priceErrorMessage()).toBe('');
    expect(router.url).toContain('max=0.33');
  });

  it('reads a comma as the decimal mark it is in six of the eight locales', async () => {
    localStorage.setItem('novamart.currency', 'USD');
    await openCatalog();

    (page() as unknown as { onPriceInput(b: 'max', v: string): void }).onPriceInput('max', '12,5');
    await settle();
    expect(consumeProductMaxPrice()).toBe(12.5);
    // The field keeps the visitor's own spelling rather than being rewritten.
    expect(priceFieldValue('max')).toBe('12,5');
  });

  it('refuses text that is not an amount instead of applying a guess', async () => {
    localStorage.setItem('novamart.currency', 'USD');
    await openCatalog('?max=200');

    (page() as unknown as { onPriceInput(b: 'max', v: string): void }).onPriceInput('max', '12.5.7');
    await settle();

    expect(priceErrorMessage()).toContain('Enter a price');
    // The applied bound stays where it was, and the text stays for correcting.
    expect(appliedQuery().maxPrice).toBe(200);
    expect(priceFieldValue('max')).toBe('12.5.7');
  });

  it('refuses a reversed range and says why, leaving the applied bounds alone', async () => {
    localStorage.setItem('novamart.currency', 'USD');
    await openCatalog('?min=500');

    (page() as unknown as { onPriceInput(b: 'max', v: number): void }).onPriceInput('max', 100);
    await settle();

    // Nothing was applied: the lower bound from the URL is still the whole
    // request, and no second list load was fired for a range that matches nothing.
    expect(appliedQuery().minPrice).toBe(500);
    expect(appliedQuery().maxPrice).toBeUndefined();
    backend.expectNone((r) => r.url.endsWith('/products'));
    // The visitor's text is kept so it can be corrected, and the reason is shown.
    expect(priceFieldValue('max')).toBe('100');
    expect(priceErrorMessage()).toContain('maximum price must be');

    // Fixing the bound clears the message and applies.
    (page() as unknown as { onPriceInput(b: 'max', v: number): void }).onPriceInput('max', 900);
    await settle();
    expect(priceErrorMessage()).toBe('');
    expect(consumeProductMaxPrice()).toBe(900);
  });

  it('refuses a negative bound instead of flooring it to zero', async () => {
    localStorage.setItem('novamart.currency', 'USD');
    await openCatalog();

    (page() as unknown as { onPriceInput(b: 'max', v: number): void }).onPriceInput('max', -5);
    await settle();

    expect(priceErrorMessage()).toContain('0 or more');
    expect(appliedQuery().maxPrice).toBeUndefined();
    backend.expectNone((r) => r.url.endsWith('/products'));
    expect(priceFieldValue('max')).toBe('-5');
  });

  it('clears an emptied upper field instead of treating it as a number', async () => {
    localStorage.setItem('novamart.currency', 'EGP');
    await openCatalog('?max=200');

    // A number input reports an emptied field as null — the bound must clear,
    // not fail to parse and silently stay applied.
    (page() as unknown as { onPriceInput(b: 'max', v: null): void }).onPriceInput('max', null);
    await settle();

    expect(consumeProductMaxPrice()).toBeNull();
    expect(router.url).not.toContain('max=');
    expect(chipTexts().some((t) => t.startsWith('≤'))).toBeFalse();
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