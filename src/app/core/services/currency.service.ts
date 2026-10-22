import { Injectable, computed, signal } from '@angular/core';
import { LANG_LOCALES } from '../config/i18n.config';
import type { SupportedLang } from '../config/i18n.config';
import { I18nService } from './i18n.service';

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isActive: boolean;
}

/** Mirrors the supported-currency endpoint. Prices stay in their saved currency; this is not an FX table. */
const CURRENCIES: CurrencyOption[] = [
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', decimalPlaces: 2, isActive: true },
  { code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2, isActive: true },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2, isActive: true },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', decimalPlaces: 2, isActive: true },
];

const STORAGE_KEY = 'novamart.currency';

@Injectable({ providedIn: 'root' })
export class CurrencyService {
  readonly options = signal<CurrencyOption[]>(CURRENCIES);
  readonly code = signal<string>('USD');
  readonly current = computed(() => this.options().find((c) => c.code === this.code()) ?? CURRENCIES[2]);

  constructor(private i18n: I18nService) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (this.options().some((currency) => currency.code === saved)) this.code.set(saved!);
    } catch {
      /* ignore */
    }

  }
  setCurrency(code: string): void {
    const normalized = code.toUpperCase();
    if (!this.options().some((currency) => currency.code === normalized)) return;
    this.code.set(normalized);
    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      /* ignore */
    }
  }

  // Intl formatters are expensive to construct and prices re-render on every
  // change-detection cycle (impure pipe over product grids), so one formatter
  // is built per locale+currency and reused for the app lifetime.
  private formatterCache = new Map<string, Intl.NumberFormat>();
  private dateFormatterCache = new Map<string, Intl.DateTimeFormat>();
  /** Fast membership/decimal lookup instead of scanning the option array. */
  private readonly codes = computed(() => new Set(this.options().map((c) => c.code)));
  private readonly decimals = computed(() => new Map(this.options().map((c) => [c.code, c.decimalPlaces])));

  private formatter(locale: string, code: string): Intl.NumberFormat {
    const key = `${locale}|${code}`;
    let f = this.formatterCache.get(key);
    if (!f) {
      f = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: code,
        maximumFractionDigits: this.decimals().get(code) ?? 2,
      });
      this.formatterCache.set(key, f);
    }
    return f;
  }

  private dateFormatter(locale: string): Intl.DateTimeFormat {
    let f = this.dateFormatterCache.get(locale);
    if (!f) {
      f = new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      this.dateFormatterCache.set(locale, f);
    }
    return f;
  }

  format(amount: number, currencyCode?: string): string {
    const lang: SupportedLang = this.i18n.currentLang();
    const locale = LANG_LOCALES[lang];
    const normalizedCode = currencyCode?.toUpperCase();
    const code = normalizedCode
      ? this.codes().has(normalizedCode) ? normalizedCode : null
      : this.current().code;
    if (!code) return `${amount.toFixed(2)} ${normalizedCode}`;
    try {
      return this.formatter(locale, code).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${code}`;
    }
  }

  formatDate(iso: string): string {
    const lang: SupportedLang = this.i18n.currentLang();
    // Read the version signal so template calls re-format on language switch.
    this.i18n.version();
    try {
      return this.dateFormatter(LANG_LOCALES[lang]).format(new Date(iso));
    } catch {
      return iso;
    }
  }
}
