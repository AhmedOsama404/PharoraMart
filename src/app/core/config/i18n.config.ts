import { en, type TranslationDict } from '../../i18n/en';
import { ar } from '../../i18n/ar';
import { cs } from '../../i18n/cs';
import { de } from '../../i18n/de';
import { fr } from '../../i18n/fr';
import { it } from '../../i18n/it';
import { pl } from '../../i18n/pl';
import { sk } from '../../i18n/sk';

// Eight supported storefront languages. Arabic is the only RTL language:
// every other language renders LTR (see LANG_DIRS).
export type SupportedLang = 'en' | 'ar' | 'cs' | 'it' | 'pl' | 'fr' | 'sk' | 'de';

export const SUPPORTED_LANGS: SupportedLang[] = ['en', 'ar', 'cs', 'it', 'pl', 'fr', 'sk', 'de'];

// BCP-47 locales used for locale-aware prices, dates and numbers.
// Currency itself stays independently configurable (CurrencyService).
export const LANG_LOCALES: Record<SupportedLang, string> = {
  en: 'en-US',
  ar: 'ar-EG',
  cs: 'cs-CZ',
  it: 'it-IT',
  pl: 'pl-PL',
  fr: 'fr-FR',
  sk: 'sk-SK',
  de: 'de-DE',
};

export const LANG_DIRS: Record<SupportedLang, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ar: 'rtl',
  cs: 'ltr',
  it: 'ltr',
  pl: 'ltr',
  fr: 'ltr',
  sk: 'ltr',
  de: 'ltr',
};

const DICTS: Record<SupportedLang, TranslationDict> = { en, ar, cs, it, pl, fr, sk, de };

export function getDict(lang: SupportedLang): TranslationDict {
  return DICTS[lang] ?? en;
}

export function lookupKey(dict: unknown, key: string): string {
  const parts = key.split('.');
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object' || !(p in (cur as Record<string, unknown>))) {
      return key;
    }
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === 'string' ? cur : key;
}

export function fillTemplate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    params[k] !== undefined ? String(params[k]) : m,
  );
}
