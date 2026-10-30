import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CurrencyService } from './currency.service';

describe('CurrencyService', () => {
  let svc: CurrencyService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(CurrencyService);
  });

  it('formats USD by default', () => {
    expect(svc.format(10)).toContain('10');
  });

  it('formats the backend amount without applying an invented exchange rate', () => {
    expect(svc.format(10)).toContain('10');
    expect(svc.current().code).toBe('USD');
    expect(svc.format(10, 'EUR')).toBe(
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(10),
    );
  });

  it('does not relabel amounts when the backend returns an unsupported currency', () => {
    expect(svc.format(10, 'GBP')).toBe('10.00 GBP');
  });

  it('accepts supported currencies and ignores unknown currency codes', () => {
    svc.setCurrency('EUR');
    expect(svc.code()).toBe('EUR');
    expect(localStorage.getItem('novamart.currency')).toBe('EUR');
    svc.setCurrency('XXX');
    expect(svc.code()).toBe('EUR');
    expect(localStorage.getItem('novamart.currency')).toBe('EUR');
  });
});
