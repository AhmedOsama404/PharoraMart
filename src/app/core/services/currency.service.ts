import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { LANG_LOCALES } from '../config/i18n.config';
import type { SupportedLang } from '../config/i18n.config';
import { environment } from '../../../environments/environment';
import { ApiClientService } from '../api/api-client.service';
import { I18nService } from './i18n.service';

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isActive: boolean;
}

/** Bundled fallback list, served until (and unless) the API answers. */
const CURRENCIES: CurrencyOption[] = [
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', decimalPlaces: 2, isActive: true },
  { code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2, isActive: true },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2, isActive: true },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', decimalPlaces: 2, isActive: true },
];

const STORAGE_KEY = 'novamart.currency';

function toCurrencyOption(raw: unknown): CurrencyOption | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const code = typeof src['code'] === 'string' ? src['code'].trim().toUpperCase() : '';
  if (!code) return null;
  return {
    code,
    name: typeof src['name'] === 'string' ? src['name'].trim() : code,
    symbol: typeof src['symbol'] === 'string' ? src['symbol'] : code,
    decimalPlaces:
      typeof src['decimalPlaces'] === 'number' && Number.isFinite(src['decimalPlaces']) && src['decimalPlaces'] >= 0
        ? src['decimalPlaces']
        : 2,
    isActive: src['isActive'] !== false,
  };
}

@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private readonly api = inject(ApiClientService);
  /** Guards the one-per-session load; a failed load may be retried. */
  private requested = false;
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

  /**
   * Loads the store's published currency list (`GET store/currencies`).
   * The bundled list is only the fallback: it stays until the API answers,
   * and is kept if the API is unreachable or returns nothing usable. Prices
   * stay in their saved currency — this is not an FX table.
   */
  load(): void {
    if (environment.useMockApi) return;
    if (this.requested) return;
    this.requested = true;
    this.api
      .get<unknown>('store/currencies', undefined, { silent: true })
      .pipe(catchError(() => of(null)))
      .subscribe((raw) => {
        const usable = Array.isArray(raw) ? raw : null;
        if (!usable) {
          // Unreachable or unusable: keep the fallback, allow a later retry.
          this.requested = false;
          return;
        }
        const mapped = usable
          .map(toCurrencyOption)
          .filter((c): c is CurrencyOption => c !== null);
        if (mapped.length === 0) return;
        this.options.set(mapped);
        // A previously saved (or default) code that the store no longer offers
        // is reset to the first option, so the price rail never shows a
        // currency it cannot format.
        if (!this.options().some((c) => c.code === this.code())) {
          this.code.set(this.options()[0].code);
        }
      });
  }

  /**
   * The currency the store prices in (`GET store/settings` → `defaultCurrency`).
   *
   * It is applied only when the visitor has NOT chosen a currency yet: a
   * stored choice is the visitor's own and always wins. An unsupported code
   * is ignored — the storefront never shows a currency it cannot format.
   */
  applyStoreDefault(code: string): void {
    const normalized = code.trim().toUpperCase();
    if (!this.options().some((currency) => currency.code === normalized)) return;
    let hasChoice = false;
    try {
      hasChoice = !!localStorage.getItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    if (hasChoice) return;
    this.code.set(normalized);
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

  /**
   * How the visitor's locale writes a currency: its symbol and whether that
   * symbol precedes the amount ("$0.00" in English, "0,00 €" in German and
   * "٣٠٠٫٠٠ ج.م." in Arabic). Control marks are stripped: this sits beside a
   * number in a field, not mid-sentence, where a bidi mark would flip what
   * surrounds it.
   */
  symbolPlacement(code?: string): { symbol: string; before: boolean } {
    const normalized = (code ?? this.current().code).toUpperCase();
    if (!this.codes().has(normalized)) return { symbol: normalized, before: true };
    const locale = LANG_LOCALES[this.i18n.currentLang()];
    try {
      const parts = this.formatter(locale, normalized).formatToParts(0);
      const at = parts.findIndex((p) => p.type === 'currency');
      const amountAt = parts.findIndex((p) => p.type === 'integer');
      const value = parts[at]?.value ?? normalized;
      return {
        symbol: value.replace(/[\u200E\u200F\u061C]/g, '').trim(),
        before: at !== -1 && at < amountAt,
      };
    } catch {
      return { symbol: normalized, before: true };
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
