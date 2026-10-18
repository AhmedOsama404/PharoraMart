import { Pipe, PipeTransform } from '@angular/core';
import { I18nService } from '../../core/services/i18n.service';
import { pickLocaleText } from '../utils/localized.utils';
import type { LocalizedText } from '../../models/product.model';

/**
 * Resolves dashboard-managed localized text for the active storefront
 * language: `names[lang]` → `names.en` → the given English fallback
 * (product `name`/`description`, which are always present).
 *
 *   {{ product.names | localized: product.name }}
 *
 * Keeping the fallback in the call site means a catalog with no translations
 * renders English exactly as before — a missing translation never blanks out.
 */
@Pipe({ name: 'localized', standalone: true })
export class LocalizedPipe implements PipeTransform {
  constructor(private readonly i18n: I18nService) {}

  transform(value: LocalizedText | null | undefined, fallback = ''): string {
    const resolved = pickLocaleText(value ?? undefined, this.i18n.currentLang());
    return resolved || fallback;
  }
}
