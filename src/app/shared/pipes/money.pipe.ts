import { Pipe, type PipeTransform } from '@angular/core';
import { CurrencyService } from '../../core/services/currency.service';

@Pipe({ name: 'money', standalone: true, pure: false })
export class MoneyPipe implements PipeTransform {
  constructor(private currency: CurrencyService) {}
  transform(usdValue: number | null | undefined): string {
    if (usdValue == null || Number.isNaN(usdValue)) return '';
    return this.currency.format(usdValue);
  }
}
