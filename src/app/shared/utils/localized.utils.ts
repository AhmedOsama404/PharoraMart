import type { SupportedLang } from '../../core/config/i18n.config';
import type { LocalizedText } from '../../models/product.model';

/**
 * Resolves dashboard-managed localized content (category names, hotel names)
 * for the active language. English is the guaranteed fallback so partially
 * translated catalogs never render blank labels. Empty/whitespace values
 * also fall back — a blank translation is worse than English.
 */
export function pickLocaleText(text: LocalizedText | undefined, lang: SupportedLang): string {
  if (!text) return '';
  const direct = text[lang]?.trim();
  if (direct) return direct;
  return text.en?.trim() ?? '';
}
