import { en, type TranslationDict } from '../../i18n/en';

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

import { RESILIENCE_DICTS } from '../../i18n/resilience';

/** Deep-merge resilience copy into every locale once at module load. */
function mergeDict(base: TranslationDict, extra: TranslationDict): TranslationDict {
  const out: TranslationDict = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const current = out[key];
    if (value && typeof value === 'object' && current && typeof current === 'object') {
      out[key] = mergeDict(current as TranslationDict, value as TranslationDict);
    } else {
      out[key] = value;
    }
  }
  return out;
}

const DICTS: Partial<Record<SupportedLang, TranslationDict>> = {
  en: mergeDict(en, RESILIENCE_DICTS.en),
};

const DICT_LOADERS: Record<Exclude<SupportedLang, 'en'>, () => Promise<TranslationDict>> = {
  ar: async () => mergeDict((await import('../../i18n/ar')).ar, RESILIENCE_DICTS.ar),
  cs: async () => mergeDict((await import('../../i18n/cs')).cs, RESILIENCE_DICTS.cs),
  de: async () => mergeDict((await import('../../i18n/de')).de, RESILIENCE_DICTS.de),
  fr: async () => mergeDict((await import('../../i18n/fr')).fr, RESILIENCE_DICTS.fr),
  it: async () => mergeDict((await import('../../i18n/it')).it, RESILIENCE_DICTS.it),
  pl: async () => mergeDict((await import('../../i18n/pl')).pl, RESILIENCE_DICTS.pl),
  sk: async () => mergeDict((await import('../../i18n/sk')).sk, RESILIENCE_DICTS.sk),
};

const pendingLoads = new Map<SupportedLang, Promise<TranslationDict>>();

export function loadDict(lang: SupportedLang): Promise<TranslationDict> {
  const cached = DICTS[lang];
  if (cached) return Promise.resolve(cached);
  const pending = pendingLoads.get(lang);
  if (pending) return pending;
  const load = DICT_LOADERS[lang as Exclude<SupportedLang, 'en'>]().then((dict) => {
    DICTS[lang] = dict;
    pendingLoads.delete(lang);
    return dict;
  }, (error: unknown) => {
    pendingLoads.delete(lang);
    throw error;
  });
  pendingLoads.set(lang, load);
  return load;
}

export function getDict(lang: SupportedLang): TranslationDict {
  return DICTS[lang] ?? DICTS.en!;
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
