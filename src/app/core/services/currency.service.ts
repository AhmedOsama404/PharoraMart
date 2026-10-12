import { Injectable, computed, signal } from '@angular/core';
import { LANG_LOCALES } from '../config/i18n.config';
import type { SupportedLang } from '../config/i18n.config';
import { I18nService } from './i18n.service';

export interface CurrencyOption {
  code: string;
  symbol: string;
  rate: number;
}

/** Rates are relative to USD base prices in mock data. Configurable. */
export const CURRENCIES: CurrencyOption[] = [
  { code: 'USD', symbol: '$', rate: 1 },
  { code: 'EUR', symbol: '€', rate: 0.92 },
  { code: 'CZK', symbol: 'Kč', rate: 23.2 },
  { code: 'EGP', symbol: 'E£', rate: 48.5 },
];

const STORAGE_KEY = 'novamart.currency';

@Injectable({ providedIn: 'root' })
export class CurrencyService {
  readonly code = signal<string>('USD');
  readonly current = computed(() => CURRENCIES.find((c) => c.code === this.code()) ?? CURRENCIES[0]);

  constructor(private i18n: I18nService) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && CURRENCIES.some((c) => c.code === saved)) this.code.set(saved);
    } catch {
      /* ignore */
    }
  }

  setCurrency(code: string): void {
    if (!CURRENCIES.some((c) => c.code === code)) return;
    this.code.set(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
  }

  convert(usdValue: number): number {
    return usdValue * this.current().rate;
  }

  // Intl formatters are expensive to construct and prices re-render on every
  // change-detection cycle (impure pipe over product grids), so one formatter
  // is built per locale+currency and reused for the app lifetime.
  private formatterCache = new Map<string, Intl.NumberFormat>();

  private formatter(locale: string, code: string): Intl.NumberFormat {
    const key = `${locale}|${code}`;
    let f = this.formatterCache.get(key);
    if (!f) {
      f = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: code,
        maximumFractionDigits: code === 'CZK' || code === 'EGP' ? 0 : 2,
      });
      this.formatterCache.set(key, f);
    }
    return f;
  }

  format(usdValue: number): string {
    const lang: SupportedLang = this.i18n.currentLang();
    const locale = LANG_LOCALES[lang];
    const { code, rate } = this.current();
    try {
      return this.formatter(locale, code).format(usdValue * rate);
    } catch {
      return `${(usdValue * rate).toFixed(2)} ${code}`;
    }
  }

  formatDate(iso: string): string {
    const lang: SupportedLang = this.i18n.currentLang();
    // Read the version signal so template calls re-format on language switch.
    this.i18n.version();
    try {
      return new Intl.DateTimeFormat(LANG_LOCALES[lang], {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }
}
