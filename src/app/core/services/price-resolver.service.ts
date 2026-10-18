import { Injectable, inject } from '@angular/core';
import { CurrencyService } from './currency.service';
import { ExchangeRatesService } from './exchange-rates.service';

export interface ResolvedPrice { readonly amount: number; readonly currency: string; }

/** One resolver for visitor-facing catalog/cart amounts; server order totals remain authoritative. */
@Injectable({ providedIn: 'root' })
export class PriceResolverService {
  private readonly currency = inject(CurrencyService);
  private readonly exchangeRates = inject(ExchangeRatesService);

  exchangeRateDate(): string | undefined { return this.exchangeRates.snapshot()?.date; }

  resolve(amount: number, sourceCode: string): ResolvedPrice | null {
    const target = this.currency.code();
    const converted = this.convert(amount, sourceCode, target);
    return converted == null ? null : { amount: converted, currency: target };
  }

  /** Converts an amount between supported currencies using the shared live rate snapshot. */
  convert(amount: number, sourceCode: string, targetCode: string): number | null {
    const converted = this.convertPrecise(amount, sourceCode, targetCode);
    return converted == null ? null : this.round(converted);
  }

  /** Converts without rounding, for filter bounds that are converted again by the API. */
  convertPrecise(amount: number, sourceCode: string, targetCode: string): number | null {
    const source = sourceCode?.toUpperCase();
    const target = targetCode?.toUpperCase();
    const supported = this.currency.options().map((item) => item.code);
    if (!Number.isFinite(amount) || !supported.includes(source) || !supported.includes(target)) return null;
    if (source === target) return amount;
    this.exchangeRates.ensureLoaded();
    const snapshot = this.exchangeRates.snapshot();
    if (!snapshot) return null;
    const sourceRate = source === 'EUR' ? 1 : snapshot.rates[source];
    const targetRate = target === 'EUR' ? 1 : snapshot.rates[target];
    if (!Number.isFinite(sourceRate) || !Number.isFinite(targetRate) || sourceRate <= 0 || targetRate <= 0) return null;
    return amount / sourceRate * targetRate;
  }

  private round(amount: number): number { return Math.round((amount + Number.EPSILON) * 100) / 100; }
}
