import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';
import { LANG_DIRS, SUPPORTED_LANGS, type SupportedLang } from '../config/i18n.config';
import { en } from '../../i18n/en';
import { ar } from '../../i18n/ar';
import { cs } from '../../i18n/cs';
import { de } from '../../i18n/de';
import { fr } from '../../i18n/fr';
import { it as itDict } from '../../i18n/it';
import { pl } from '../../i18n/pl';
import { sk } from '../../i18n/sk';

const ALL_DICTS: Record<SupportedLang, typeof en> = { en, ar, cs, de, fr, it: itDict, pl, sk };

function keysOf(obj: object, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === 'object') out.push(...keysOf(v as object, path));
    else out.push(path);
  }
  return out.sort();
}

function valuesOf(obj: object, out: string[] = []): string[] {
  for (const v of Object.values(obj)) {
    if (v != null && typeof v === 'object') valuesOf(v as object, out);
    else if (typeof v === 'string') out.push(v);
  }
  return out;
}

describe('I18nService', () => {
  let svc: I18nService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.setAttribute('lang', 'en');
    document.documentElement.setAttribute('dir', 'ltr');
    TestBed.configureTestingModule({});
    svc = TestBed.inject(I18nService);
  });

  it('supports all eight languages', () => {
    expect(SUPPORTED_LANGS).toEqual(['en', 'ar', 'cs', 'it', 'pl', 'fr', 'sk', 'de']);
    for (const lang of SUPPORTED_LANGS) {
      expect(ALL_DICTS[lang]).toBeTruthy();
    }
  });

  it('defaults to English LTR', () => {
    expect(svc.currentLang()).toBe('en');
    expect(svc.dir()).toBe('ltr');
  });

  it('loads the selected language with persistence and DOM attrs', async () => {
    await svc.setLang('ar');
    expect(svc.currentLang()).toBe('ar');
    expect(svc.dir()).toBe('rtl');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
    expect(localStorage.getItem('novamart.lang')).toBe('ar');
    expect(svc.t('nav.home')).toBe((ar['nav'] as Record<string, string>)['home']);
  });

  it('uses LTR for Czech and translates strings', async () => {
    await svc.setLang('cs');
    expect(svc.dir()).toBe(LANG_DIRS['cs']);
    expect(svc.t('nav.cart')).toBe((cs['nav'] as Record<string, string>)['cart']);
  });

  it('renders Arabic RTL and every other language LTR', async () => {
    for (const lang of SUPPORTED_LANGS) {
      await svc.setLang(lang);
      const expected = lang === 'ar' ? 'rtl' : 'ltr';
      expect(svc.dir()).withContext(lang).toBe(expected);
      expect(document.documentElement.getAttribute('dir')).withContext(lang).toBe(expected);
      expect(document.documentElement.getAttribute('lang')).withContext(lang).toBe(lang);
      // Every language translates a core string (no silent English fallback).
      expect(svc.t('nav.home')).withContext(lang).toBe(
        (ALL_DICTS[lang]['nav'] as Record<string, string>)['home'],
      );
    }
  });

  it('restores the persisted language on the next visit', () => {
    localStorage.setItem('novamart.lang', 'sk');
    // A new root injector (what app bootstrap creates on refresh) must pick
    // up the stored choice without any navigation or reload logic.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const fresh = TestBed.inject(I18nService);
    expect(fresh.currentLang()).toBe('sk');
    expect(document.documentElement.getAttribute('lang')).toBe('sk');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });

  it('interpolates params', () => {
    expect(svc.t('product.off', { percent: 20 })).toContain('20');
  });

  it('keeps every placeholder intact across all languages', () => {
    const ref = keysOf(en);
    for (const lang of SUPPORTED_LANGS) {
      const dict = ALL_DICTS[lang];
      for (const key of ref) {
        const enVal = key
          .split('.')
          .reduce<unknown>((o, p) => (o as Record<string, unknown>)?.[p], en);
        const val = key
          .split('.')
          .reduce<unknown>((o, p) => (o as Record<string, unknown>)?.[p], dict);
        if (typeof enVal === 'string' && typeof val === 'string') {
          const paramsOf = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
          expect(paramsOf(val)).withContext(`${lang}:${key}`).toBe(paramsOf(enVal));
        }
      }
    }
  });

  it('falls back to the key for missing entries', () => {
    expect(svc.t('does.not.exist')).toBe('does.not.exist');
  });

  it('keeps translation keys consistent across all eight languages', () => {
    const ref = keysOf(en);
    expect(ref.length).toBeGreaterThan(200);
    for (const lang of SUPPORTED_LANGS) {
      expect(keysOf(ALL_DICTS[lang])).withContext(lang).toEqual(ref);
    }
  });

  it('has no empty translations in any language', () => {
    for (const lang of SUPPORTED_LANGS) {
      const empties = valuesOf(ALL_DICTS[lang]).filter((v) => v.trim() === '');
      expect(empties).withContext(lang).toEqual([]);
    }
  });
});
