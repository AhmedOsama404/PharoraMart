import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

export const emailValidator = Validators.email;
export const requiredValidator = Validators.required;
export const phoneValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const v = String(control.value ?? '').trim();
  if (!v) return null;
  return /^[+]?[\d\s-]{7,15}$/.test(v) ? null : { phone: true };
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
