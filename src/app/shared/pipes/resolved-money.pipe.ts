import { Pipe, type PipeTransform, inject } from '@angular/core';
import { I18nService } from '../../core/services/i18n.service';
import { CurrencyService } from '../../core/services/currency.service';
import { PriceResolverService } from '../../core/services/price-resolver.service';

@Pipe({ name: 'resolvedMoney', standalone: true, pure: false })
export class ResolvedMoneyPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  private readonly currency = inject(CurrencyService);
  private readonly prices = inject(PriceResolverService);

  transform(amount: number | null | undefined, sourceCurrency?: string): string {
    if (amount == null || !Number.isFinite(amount) || !sourceCurrency) return '';
    const resolved = this.prices.resolve(amount, sourceCurrency);
    return resolved ? this.currency.format(resolved.amount, resolved.currency) : this.i18n.t('currency.conversionUnavailable');
  }
}
