import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Validates a mobile number. Values coming from the country-code phone input
 * are E.164 ("+201001234567") and are checked against the real numbering plan;
 * legacy free-typed values (no country) fall back to a 7–15 digit length check.
 * Empty is allowed here; requiredness is set per form.
 */
export const phoneValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const v = String(control.value ?? '').trim();
  if (!v) return null;
  if (v.startsWith('+')) {
    const parsed = parsePhoneNumberFromString(v);
    return parsed?.isValid() ? null : { phone: true };
  }
  const digits = v.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 ? null : { phone: true };
};

export function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const pass = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  if (pass == null || confirm == null) return null;
  return pass === confirm ? null : { passwordMismatch: true };
}

/** Maps control errors to i18n keys for templates. */
export function firstErrorKey(control: AbstractControl | null | undefined): string | null {
  if (!control || !control.errors || !(control.touched || control.dirty)) return null;
  if (control.errors['required']) return 'validation.required';
  if (control.errors['email']) return 'validation.email';
  if (control.errors['minlength'])
    return 'validation.minLength';
  if (control.errors['phone']) return 'validation.phone';
  if (control.errors['passwordMismatch']) return 'validation.passwordMismatch';
  return 'validation.required';
}
