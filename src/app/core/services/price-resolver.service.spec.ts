import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CurrencyService } from './currency.service';
import { ExchangeRatesService } from './exchange-rates.service';
import { PriceResolverService } from './price-resolver.service';

describe('PriceResolverService', () => {
  let prices: PriceResolverService;
  let currency: CurrencyService;
  const rates = {
    baseCurrency: 'EUR' as const,
    date: '2026-10-15',
    source: 'test provider',
    rates: { EGP: 50, USD: 1.1, CZK: 24 },
  };

  beforeEach(() => {
    localStorage.removeItem('novamart.currency');
    TestBed.configureTestingModule({
      providers: [{
        provide: ExchangeRatesService,
        useValue: { snapshot: signal(rates), ensureLoaded: jasmine.createSpy('ensureLoaded') },
      }],
    });
    prices = TestBed.inject(PriceResolverService);
    currency = TestBed.inject(CurrencyService);
  });

  it('preserves the exact amount when source and selected currency match', () => {
    expect(prices.resolve(100, 'USD')).toEqual({ amount: 100, currency: 'USD' });
  });

  it('converts from a stored amount through the shared EUR-base rates', () => {
    currency.setCurrency('USD');
    expect(prices.resolve(100, 'EGP')).toEqual({ amount: 2.2, currency: 'USD' });
  });

  it('updates the resolved amount when the persisted header currency changes', () => {
    currency.setCurrency('CZK');
    expect(prices.resolve(10, 'EUR')).toEqual({ amount: 240, currency: 'CZK' });
  });

  it('does not invent an amount for unsupported currencies', () => {
    expect(prices.resolve(10, 'GBP')).toBeNull();
  });
});
