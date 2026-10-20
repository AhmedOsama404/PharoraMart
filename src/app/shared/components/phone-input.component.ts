import { SafeImageDirective } from '../resilience/safe-image.directive';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule, NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import {
  AsYouType,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';
import { I18nService } from '../../core/services/i18n.service';
import { LANG_LOCALES } from '../../core/config/i18n.config';
import { countryFlagPath as getCountryFlagPath, DEFAULT_PHONE_COUNTRY, phoneCountryOptions } from '../utils/countries';

/**
 * Country-code mobile number input.
 *
 * Renders a searchable dial-code picker plus a national number field and works
 * as a reactive-forms control: the form value is always a normalized E.164
 * string (for example "+201001234567"), or "" while the field is empty. The
 * country picker remembers the region of any incoming value, so a signed-in
 * customer's saved number reopens on its own country. Validation stays on the
 * form control (see `phoneValidator`); this component only formats and emits.
 */
@Component({
  selector: 'app-phone-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SafeImageDirective, FormsModule, Select, InputText],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PhoneInputComponent),
      multi: true,
    },
  ],
  templateUrl: './phone-input.component.html',
  styleUrl: './phone-input.component.scss',
})
export class PhoneInputComponent implements ControlValueAccessor {
  protected i18n = inject(I18nService);


  /** id applied to the number field so an external <label for> stays wired. */
  readonly inputId = input('phone');

  /** Region preselected for an empty field (callers may override per usage). */
  @Input() set defaultCountry(value: CountryCode | null | undefined) {
    if (value && !this.userTouched() && !this.national()) {
      this.country.set(value);
    }
  }

  protected readonly country = signal<CountryCode>(DEFAULT_PHONE_COUNTRY);
  protected readonly national = signal('');
  protected readonly disabled = signal(false);
  private readonly userTouched = signal(false);

  private onChange: (value: string) => void = () => {};
  private onTouchedFn: () => void = () => {};

  /** Dial-code options with names localized to the active language. */
  protected readonly countryOptions = computed(() =>
    phoneCountryOptions(LANG_LOCALES[this.i18n.currentLang()]),
  );

  /** National number formatted for display while the user types. */
  protected readonly display = computed(() => {
    const digits = this.national();
    if (!digits) return '';
    try {
      return new AsYouType(this.country()).input(digits);
    } catch {
      return digits;
    }
  });

  protected countryFlagPath(value: CountryCode): string {
    return getCountryFlagPath(value);
  }

  protected onCountryChange(value: CountryCode): void {
    this.userTouched.set(true);
    this.country.set(value);
    this.onChange(this.e164());
  }

  protected onInput(event: Event): void {
    this.userTouched.set(true);
    this.national.set((event.target as HTMLInputElement).value.replace(/\D/g, ''));
    this.onChange(this.e164());
  }

  protected onBlur(): void {
    this.onTouchedFn();
  }

  /** Builds the E.164 value (trunk prefixes handled) or "" when empty. */
  private e164(): string {
    const digits = this.national();
    if (!digits) return '';
    const parsed = parsePhoneNumberFromString(digits, this.country());
    return parsed?.number ?? `+${getCountryCallingCode(this.country())}${digits}`;
  }

  // ControlValueAccessor — the form drives the value; the country is inferred.
  writeValue(value: string | null): void {
    if (!value) {
      this.national.set('');
      return;
    }
    const trimmed = value.trim();
    if (trimmed.startsWith('+')) {
      const parsed = parsePhoneNumberFromString(trimmed);
      if (parsed) {
        this.country.set(parsed.country ?? DEFAULT_PHONE_COUNTRY);
        this.national.set(parsed.nationalNumber);
        return;
      }
    }
    this.national.set(trimmed.replace(/\D/g, ''));
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouchedFn = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }
}