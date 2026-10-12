import { Injectable, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import {
  LANG_DIRS,
  SUPPORTED_LANGS,
  fillTemplate,
  getDict,
  lookupKey,
  type SupportedLang,
} from '../config/i18n.config';

const STORAGE_KEY = 'novamart.lang';

export function detectInitialLang(fallback: SupportedLang = 'en'): SupportedLang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as SupportedLang | null;
    if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
  } catch {
    /* ignore */
  }
  return fallback;
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  private doc = inject(DOCUMENT);
  readonly currentLang = signal<SupportedLang>(detectInitialLang());
  readonly dir = computed(() => LANG_DIRS[this.currentLang()]);
  /** Bumped on every language change so impure consumers can react. */
  readonly version = signal(0);

  constructor() {
    this.applyDomAttrs(this.currentLang());
  }

  t(key: string, params?: Record<string, string | number>): string {
    // Track the signals so template calls re-evaluate on language change.
    const lang = this.currentLang();
    this.version();
    return fillTemplate(lookupKey(getDict(lang), key), params);
  }

  setLang(lang: SupportedLang): void {
    if (!SUPPORTED_LANGS.includes(lang)) return;
    if (this.currentLang() === lang) return;
    this.currentLang.set(lang);
    this.version.update((v) => v + 1);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    this.applyDomAttrs(lang);
  }

  isRtl(): boolean {
    return this.dir() === 'rtl';
  }

  private applyDomAttrs(lang: SupportedLang): void {
    const html = this.doc?.documentElement;
    if (!html) return;
    html.setAttribute('lang', lang);
    html.setAttribute('dir', LANG_DIRS[lang]);
  }
}
