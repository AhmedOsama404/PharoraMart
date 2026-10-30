import { SUPPORTED_LANGS } from '../config/i18n.config';
import type { LocalizedText } from '../../models/product.model';
import type { StorefrontTheme } from '../../models/theme.model';

/**
 * Single typed boundary for the public theme DTO (GET /api/v1/store/theme).
 * The backend JSON is camelCase (see ThemeDto / LocalizedTextDto) and every
 * field is treated as untrusted input: a missing value, a wrong type or a
 * null must never reach a template. Colors are validated as hex; anything
 * else falls back to the compiled palette so an unexpected body can never
 * paint an unreadable (or invalid) style.
 */

/** The compiled `:root` palette in styles.scss — the unpublished/offline identity. */
export const THEME_FALLBACK = {
  primaryColor: '#2e7d52',
  secondaryColor: '#fdfcf8',
  accentColor: '#c9a227',
  surfaceColor: '#ffffff',
  textColor: '#1e2b23',
} as const;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** A valid hex color, else the fallback (never an empty/invalid value). */
function toHex(value: unknown, fallback: string): string {
  const text = toText(value);
  return HEX.test(text) ? text.toLowerCase() : fallback;
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** A localized value; null when the payload carries no usable text at all. */
function toLocalized(value: unknown): LocalizedText | null {
  const src = isPlainObject(value) ? value : {};
  const en = toText(src['en']);
  const text: LocalizedText = { en };
  let usable = en.length > 0;
  for (const lang of SUPPORTED_LANGS) {
    if (lang === 'en') continue;
    const raw = src[lang];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      text[lang] = raw.trim();
      usable = true;
    }
  }
  return usable ? text : null;
}

/**
 * Normalizes the theme DTO. Returns null when the payload is not a plain
 * object (an array or a primitive) — such a payload is never stored.
 */
export function toTheme(raw: unknown): StorefrontTheme | null {
  if (!isPlainObject(raw)) return null;
  const country = toText(raw['defaultPhoneCountry']).toUpperCase().slice(0, 2);
  return {
    primaryColor: toHex(raw['primaryColor'], THEME_FALLBACK.primaryColor),
    secondaryColor: toHex(raw['secondaryColor'], THEME_FALLBACK.secondaryColor),
    accentColor: toHex(raw['accentColor'], THEME_FALLBACK.accentColor),
    surfaceColor: toHex(raw['surfaceColor'], THEME_FALLBACK.surfaceColor),
    textColor: toHex(raw['textColor'], THEME_FALLBACK.textColor),
    fontFamily: toText(raw['fontFamily']),
    logoUrl: toText(raw['logoUrl']),
    faviconUrl: toText(raw['faviconUrl']),
    socialShareUrl: toText(raw['socialShareUrl']),
    metaTitle: toLocalized(raw['metaTitle']),
    metaDescription: toLocalized(raw['metaDescription']),
    metaKeywords: toLocalized(raw['metaKeywords']),
    promoHeadline: toLocalized(raw['promoHeadline']),
    promoBody: toLocalized(raw['promoBody']),
    promoBadge: toLocalized(raw['promoBadge']),
    promoCtaLabel: toLocalized(raw['promoCtaLabel']),
    promoCtaUrl: toText(raw['promoCtaUrl']),
    promoImageUrl: toText(raw['promoImageUrl']),
    defaultPhoneCountry: /^[a-z]{2}$/i.test(country) ? country : '',
    isPublished: raw['isPublished'] === true,
    rowVersion: toNumber(raw['rowVersion']),
    updatedAt: toText(raw['updatedAt']),
  };
}
