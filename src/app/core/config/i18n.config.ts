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

import { resilienceEn } from '../../i18n/resilience-en';

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
  en: mergeDict(en, resilienceEn),
};

const DICT_LOADERS: Record<Exclude<SupportedLang, 'en'>, () => Promise<TranslationDict>> = {
  ar: async () => {
    const [base, resilience] = await Promise.all([import('../../i18n/ar'), import('../../i18n/resilience')]);
    return mergeDict(base.ar, resilience.RESILIENCE_DICTS.ar);
  },
  cs: async () => {
    const [base, resilience] = await Promise.all([import('../../i18n/cs'), import('../../i18n/resilience')]);
    return mergeDict(base.cs, resilience.RESILIENCE_DICTS.cs);
  },
  de: async () => {
    const [base, resilience] = await Promise.all([import('../../i18n/de'), import('../../i18n/resilience')]);
    return mergeDict(base.de, resilience.RESILIENCE_DICTS.de);
  },
  fr: async () => {
    const [base, resilience] = await Promise.all([import('../../i18n/fr'), import('../../i18n/resilience')]);
    return mergeDict(base.fr, resilience.RESILIENCE_DICTS.fr);
  },
  it: async () => {
    const [base, resilience] = await Promise.all([import('../../i18n/it'), import('../../i18n/resilience')]);
    return mergeDict(base.it, resilience.RESILIENCE_DICTS.it);
  },
  pl: async () => {
    const [base, resilience] = await Promise.all([import('../../i18n/pl'), import('../../i18n/resilience')]);
    return mergeDict(base.pl, resilience.RESILIENCE_DICTS.pl);
  },
  sk: async () => {
    const [base, resilience] = await Promise.all([import('../../i18n/sk'), import('../../i18n/resilience')]);
    return mergeDict(base.sk, resilience.RESILIENCE_DICTS.sk);
  },
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
