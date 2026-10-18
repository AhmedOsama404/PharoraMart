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
    const source = sourceCode?.toUpperCase();
    const target = this.currency.code();
    if (!Number.isFinite(amount) || !this.currency.options().some((item) => item.code === source)) return null;
    if (source === target) return { amount: this.round(amount), currency: target };
    this.exchangeRates.ensureLoaded();
    const snapshot = this.exchangeRates.snapshot();
    if (!snapshot) return null;
    const sourceRate = source === 'EUR' ? 1 : snapshot.rates[source];
    const targetRate = target === 'EUR' ? 1 : snapshot.rates[target];
    if (!Number.isFinite(sourceRate) || !Number.isFinite(targetRate) || sourceRate <= 0 || targetRate <= 0) return null;
    return { amount: this.round(amount / sourceRate * targetRate), currency: target };
  }

  private round(amount: number): number { return Math.round((amount + Number.EPSILON) * 100) / 100; }
}
