import { Pipe, type PipeTransform } from '@angular/core';
import { CurrencyService } from '../../core/services/currency.service';

@Pipe({ name: 'money', standalone: true, pure: false })
export class MoneyPipe implements PipeTransform {
  constructor(private currency: CurrencyService) {}
  transform(amount: number | null | undefined, currencyCode?: string): string {
    if (amount == null || Number.isNaN(amount)) return '';
    return this.currency.format(amount, currencyCode);
  }
}
