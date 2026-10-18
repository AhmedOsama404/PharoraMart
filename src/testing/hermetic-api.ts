import type { EnvironmentProviders, Provider } from '@angular/core';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ExchangeRatesService } from '../app/core/services/exchange-rates.service';

/**
 * Shared wiring for hermetic specs. Two things became necessary once prices and
 * delivery quotes turned FX-aware:
 *
 * - `ApiClientService` (and therefore `ExchangeRatesService`) constructs an
 *   `HttpClient`, so any spec whose service graph reaches it needs the HTTP
 *   providers even when every feature service is stubbed.
 * - the quote/price maths needs a rate snapshot; without one every
 *   cross-currency amount resolves to `null`, which silently drops cart lines
 *   and fails the "once quoted" checkout flow.
 *
 * The values mirror `price-resolver.service.spec.ts` so all specs agree.
 */
const RATES = {
  baseCurrency: 'EUR' as const,
  date: '2026-10-15',
  source: 'test',
  rates: { EGP: 50, USD: 1.1, CZK: 24 },
};

/** A fixed rate snapshot, for specs that already provide the HTTP client. */
export const testRatesProvider: Provider = {
  provide: ExchangeRatesService,
  useValue: { snapshot: signal(RATES), ensureLoaded: () => undefined },
};

/** HTTP client + testing backend + the fixed rate snapshot. */
export function hermeticApi(): (Provider | EnvironmentProviders)[] {
  return [provideHttpClient(), provideHttpClientTesting(), testRatesProvider];
}
