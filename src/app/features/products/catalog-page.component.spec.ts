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

/** The catalogue's real top price, as the API states it in its USD contract. */
const PRICE_RANGE = { minPrice: 0, maxPrice: 97.43, currency: 'USD' };

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
    // (a persisted currency changes what other suites resolve). Same for the
    // language, which decides whether the rail axis runs left or right.
    localStorage.removeItem('novamart.currency');
    localStorage.removeItem('novamart.lang');
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
   * The catalogue's price span is asked for once, and only to decide how long
   * the rail is. Nothing that arrives here may cap a typed bound, so the tests
   * flush it rather than assert it never happens.
   */
  function flushPriceRange(range = PRICE_RANGE): void {
    for (const req of backend.match((r) => r.url.endsWith('/products/price-range'))) {
      req.flush(range);
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

  async function openCatalog(query = '', priceRange = PRICE_RANGE): Promise<void> {
    await harness.navigateByUrl(`/products${query}`, CatalogPageComponent);
    fixture = harness.fixture as unknown as ComponentFixture<CatalogPageComponent>;

    // Intercept the initialization requests:
    // 1) exchange-rates (from effect triggered by currency change)
    // 2) categories (ngOnInit subscription)
    // 3) products (the query-param subscription)
    // 4) price-range (the rail's scale, once per session)
    flushRates();
    backend
      .expectOne((r) => r.url.endsWith('/categories') || r.url.includes('/categories?'))
      .flush([]);
    backend.expectOne((r) => r.url.endsWith('/products')).flush(EMPTY_PAGE);
    flushPriceRange(priceRange);
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

  /** The rail's axis top in the visitor's currency, or null when there is no rail. */
  const railMax = (): number | null =>
    (page() as unknown as { priceRailMax(): number | null }).priceRailMax();

  /**
   * Presses one key on a rail handle and answers the list load it causes,
   * returning the `maxPrice` bounds requested. `settle()` is deliberately not
   * used after the press: the key publishes a URL, and waiting for zone
   * stability across that navigation from inside the navigation's own task
   * never finishes. The pause covers the 350 ms debounce instead.
   */
  async function pressRailKey(
    handle: 'starthandler' | 'endhandler',
    code: string,
  ): Promise<{ handled: boolean; bounds: (number | null)[] }> {
    const el = (fixture.nativeElement as HTMLElement).querySelector(
      `.p-slider-handle[data-pc-section="${handle}"]`,
    ) as HTMLElement | null;
    expect(el).withContext('rail handle').not.toBeNull();
    el!.focus();
    const event = new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true });
    el!.dispatchEvent(event);
    await new Promise((r) => setTimeout(r, 500));
    fixture.detectChanges();
    const bounds = backend
      .match((r) => r.url.endsWith('/products'))
      .map((req) => {
        const raw = req.request.params.get('maxPrice');
        req.flush(EMPTY_PAGE);
        return raw === null ? null : Number(raw);
      });
    return { handled: event.defaultPrevented, bounds };
  }

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

  it('uses the catalogue ceiling for the rail scale and never as a cap', async () => {
    localStorage.setItem('novamart.currency', 'USD');
    await openCatalog();

    // Neither field invents a number the visitor did not type: an empty
    // minimum is empty, and the placeholder states the format a bound takes.
    expect(priceFieldValue('min')).toBe('');
    expect(priceFieldPlaceholder('min')).toBe('0.00');
    expect(priceFieldPlaceholder('max')).toBe('No maximum');
    // Fractions are a real case on this catalogue (items at 0.33 and 0.35), so
    // the accepted format is stated once, under the pair.
    expect(priceHint()).toContain('Decimals are accepted');
    expect(priceHint()).toContain('no limit');
    const body = fixture.nativeElement as HTMLElement;
    expect(body.querySelector('.price-msg.is-error')).toBeNull();

    // 97.43 is the priciest product; the axis ends at the legible number above
    // it, which is a scale, not a limit.
    expect(railMax()).toBe(100);
    expect(body.querySelector('p-slider')).not.toBeNull();

    // A bound above the rail's top is applied exactly as typed…
    (page() as unknown as { onPriceInput(b: 'max', v: number): void }).onPriceInput('max', 4000);
    await settle();
    expect(consumeProductMaxPrice()).toBe(4000);
    expect(appliedQuery().maxPrice).toBe(4000);
    expect(priceFieldValue('max')).toBe('4000');
    // …and the axis grows to hold it rather than refusing it.
    expect(railMax()).toBe(4000);
  });

  it('draws no rail when the catalogue has no price span', async () => {
    localStorage.setItem('novamart.currency', 'USD');
    // (0, 0) is the API's answer for an empty catalogue: no scale to draw, and
    // the two fields must go on working.
    await openCatalog('', { minPrice: 0, maxPrice: 0, currency: 'USD' });

    expect(fixture.nativeElement.querySelector('p-slider')).toBeNull();
    expect(railMax()).toBeNull();
    (page() as unknown as { onPriceInput(b: 'max', v: number): void }).onPriceInput('max', 25);
    await settle();
    expect(consumeProductMaxPrice()).toBe(25);
  });

  it('writes a rail drag into the same bounds the fields would have applied', async () => {
    localStorage.setItem('novamart.currency', 'USD');
    await openCatalog();

    // One path for both controls: a drag reports two handles and must reach the
    // URL, the chip and the request exactly as typing would.
    (page() as unknown as { onRailChange(e: { values: number[] }): void }).onRailChange({ values: [20, 60] });
    await settle();

    expect(priceFieldValue('min')).toBe('20');
    expect(priceFieldValue('max')).toBe('60');
    expect(consumeProductMaxPrice()).toBe(60);
    expect(router.url).toContain('min=20');
    expect(router.url).toContain('max=60');
    expect(railMax()).toBe(100);

    // PrimeNG's range handles announce nothing on their own (it reads a `value`
    // that range mode never fills), so the drag has to be legible to a screen
    // reader as well as to a pointer.
    const handles = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.p-slider-handle'),
    ) as HTMLElement[];
    expect(handles.length).toBe(2);
    expect(handles.map((h) => h.getAttribute('aria-valuenow'))).toEqual(['20', '60']);
    expect(handles[0]!.getAttribute('aria-valuetext')).toContain('20');
  });

  it('steps a handle toward the end the Arabic axis actually reads', async () => {
    localStorage.setItem('novamart.currency', 'USD');
    localStorage.setItem('novamart.lang', 'ar');
    await openCatalog('?max=50');

    // Right-to-left puts the low end of the rail on the right, so ArrowLeft
    // means "more" here — the mirror of what the library's key handler assumes.
    const { handled, bounds } = await pressRailKey('endhandler', 'ArrowLeft');
    expect(handled).toBeTrue();
    expect(bounds).toEqual([52]);
    expect(priceFieldValue('max')).toBe('52');
  });

  it('leaves an arrow key to the library when the axis reads left to right', async () => {
    localStorage.setItem('novamart.currency', 'USD');
    await openCatalog('?max=50');

    // The same key on an LTR axis still lowers the bound, one step at a time.
    const { handled, bounds } = await pressRailKey('endhandler', 'ArrowLeft');
    expect(handled).toBeTrue();
    expect(bounds).toEqual([48]);
    expect(priceFieldValue('max')).toBe('48');
  });

  it('names the currency in the fields the way the locale writes it', async () => {
    localStorage.setItem('novamart.currency', 'EGP');
    localStorage.setItem('novamart.lang', 'ar');
    await openCatalog();

    const box = fixture.nativeElement.querySelector('#catalog-price-min-panel')?.closest('.price-field-box');
    const suffix = (box?.querySelector('.price-currency') as HTMLElement | null)?.textContent?.trim();
    // The rail, the chips and the fields all speak one currency accent; a
    // Latin "EGP" inside Arabic text made the fields look like a different app.
    expect(suffix).toBe('ج.م.');
    expect(box?.classList.contains('symbol-first')).toBeFalse();
    const railEnd = (fixture.nativeElement.querySelector('.rail-end') as HTMLElement | null)?.textContent ?? '';
    expect(railEnd).toContain('ج.م.');
  });

  it('reads the last stop of the rail as no maximum', async () => {
    localStorage.setItem('novamart.currency', 'USD');
    await openCatalog('?max=50');

    // The axis top means the same thing an emptied field means — dropping the
    // handle there lifts the cap instead of setting a bound of 100.
    (page() as unknown as { onRailSlideEnd(e: { values: number[] }): void }).onRailSlideEnd({ values: [0, 100] });
    await settle();

    expect(priceFieldValue('max')).toBe('');
    expect(consumeProductMaxPrice()).toBeNull();
    expect(router.url).not.toContain('max=');
    expect(chipTexts().some((t) => t.startsWith('≤'))).toBeFalse();
    // The handle parked on the axis top says what it means instead of reading
    // as a bound of exactly that number.
    const ends = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.p-slider-handle'),
    ) as HTMLElement[];
    expect(ends[1]!.getAttribute('aria-valuetext')).toBe('No maximum');
  });

  it('keeps a fraction reachable on a cheap catalogue scale', async () => {
    localStorage.setItem('novamart.currency', 'EGP');
    // A catalogue of small items: the axis must round up to 0.5 and still step
    // finely enough that 0.33 is a position a handle can hold.
    await openCatalog('', { minPrice: 0, maxPrice: 0.33, currency: 'USD' });

    expect(railMax()).toBeCloseTo(20, 1);
    const step = (page() as unknown as { priceRailStep(): number }).priceRailStep();
    expect(step).toBeLessThanOrEqual(0.5);
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

  it('applies a fractional minimum and maximum as an ordinary range', async () => {
    localStorage.setItem('novamart.currency', 'USD');
    await openCatalog();

    // The catalogue holds items at 0.33 and 0.35 USD, so a bound below one
    // dollar is a normal question — both ends must reach the API intact.
    const api = page() as unknown as { onPriceInput(b: 'min' | 'max', v: string): void };
    api.onPriceInput('min', '0.2');
    api.onPriceInput('max', '0.35');
    await settle();

    const req = backend.expectOne((r) => r.url.endsWith('/products'));
    expect(Number(req.request.params.get('minPrice'))).toBe(0.2);
    expect(Number(req.request.params.get('maxPrice'))).toBe(0.35);
    req.flush(EMPTY_PAGE);

    expect(router.url).toContain('min=0.2');
    expect(router.url).toContain('max=0.35');
    expect(priceFieldValue('min')).toBe('0.2');
    expect(priceFieldValue('max')).toBe('0.35');
    expect(chipTexts().some((t) => t.includes('0.2'))).toBeTrue();
    expect(chipTexts().some((t) => t.includes('0.35'))).toBeTrue();
    expect(priceErrorMessage()).toBe('');
    // A usable pair is described by the format hint, not by a refusal.
    expect(priceFieldEl('max')!.getAttribute('aria-describedby')).toBe('catalog-price-hint-panel');
    expect(priceFieldEl('max')!.getAttribute('aria-invalid')).toBeNull();
    // English writes the symbol in front of the amount, as the rail does.
    const box = priceFieldEl('min')!.closest('.price-field-box');
    expect(box?.classList.contains('symbol-first')).toBeTrue();
    expect((box?.querySelector('.price-currency') as HTMLElement | null)?.textContent?.trim()).toBe('$');
  });

  it('keeps a fractional EUR range convertible to the USD contract', async () => {
    localStorage.setItem('novamart.currency', 'EUR');
    await openCatalog();

    const api = page() as unknown as { onPriceInput(b: 'min' | 'max', v: string): void };
    api.onPriceInput('min', '0,2');
    api.onPriceInput('max', '0,35');
    await settle();

    // The URL speaks what the shopper typed, in their own currency…
    expect(router.url).toContain('min=0.2');
    expect(router.url).toContain('max=0.35');
    // …and only the request is pivoted to the server's USD contract.
    const req = backend.expectOne((r) => r.url.endsWith('/products'));
    expect(Number(req.request.params.get('minPrice'))).toBeCloseTo(0.2 * RATES.rates.USD, 6);
    expect(Number(req.request.params.get('maxPrice'))).toBeCloseTo(0.35 * RATES.rates.USD, 6);
    req.flush(EMPTY_PAGE);
    expect(priceErrorMessage()).toBe('');
  });

  it('accepts equal fractional bounds', async () => {
    localStorage.setItem('novamart.currency', 'USD');
    await openCatalog();

    // Equal is the boundary the order check must allow: the reason to refuse
    // starts strictly below the minimum.
    const api = page() as unknown as { onPriceInput(b: 'min' | 'max', v: string): void };
    api.onPriceInput('min', '0.35');
    api.onPriceInput('max', '0.35');
    await settle();

    const req = backend.expectOne((r) => r.url.endsWith('/products'));
    expect(Number(req.request.params.get('minPrice'))).toBe(0.35);
    expect(Number(req.request.params.get('maxPrice'))).toBe(0.35);
    req.flush(EMPTY_PAGE);
    expect(priceErrorMessage()).toBe('');
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
    // The refusal is tied to the fields themselves, not only painted under
    // them: the pair is marked invalid and both point at the message.
    expect(priceFieldEl('min')!.getAttribute('aria-invalid')).toBe('true');
    expect(priceFieldEl('max')!.getAttribute('aria-invalid')).toBe('true');
    expect(priceFieldEl('min')!.getAttribute('aria-describedby')).toBe('catalog-price-msg-panel');
    expect(priceFieldEl('max')!.getAttribute('aria-describedby')).toBe('catalog-price-msg-panel');

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