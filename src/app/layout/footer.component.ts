import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService, CURRENCIES } from '../core/services/currency.service';
import { ContactService } from '../core/services/contact.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, Select],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  protected i18n = inject(I18nService);
  protected currency = inject(CurrencyService);
  protected contact = inject(ContactService);
  protected year = new Date().getFullYear();
  protected currencyModel = this.currency.code();
  protected currencyOptions = CURRENCIES.map((c) => ({ label: c.code, value: c.code }));

  // Public business hours from environment config (dashboard-owned later).
  protected businessHours(): string {
    return this.contact.businessHours;
  }

  protected onCurrency(code: string): void {
    this.currencyModel = code;
    this.currency.setCurrency(code);
  }
}
