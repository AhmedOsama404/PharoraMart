import { TestBed } from '@angular/core/testing';
import { CurrencyService } from './currency.service';

describe('CurrencyService', () => {
  let svc: CurrencyService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    svc = TestBed.inject(CurrencyService);
  });

  it('formats USD by default', () => {
    expect(svc.format(10)).toContain('10');
  });

  it('converts and persists currency independently of language', () => {
    svc.setCurrency('CZK');
    expect(svc.code()).toBe('CZK');
    expect(localStorage.getItem('novamart.currency')).toBe('CZK');
    const czk = svc.format(10);
    svc.setCurrency('USD');
    expect(svc.format(10)).not.toBe(czk);
  });

  it('ignores unknown currency codes', () => {
    svc.setCurrency('XXX');
    expect(svc.code()).toBe('USD');
  });
});
