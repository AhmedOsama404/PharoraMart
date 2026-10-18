import { FormControl, FormGroup, Validators } from '@angular/forms';
import { firstErrorKey, passwordMatchValidator, phoneValidator } from './validators';

describe('shared validators', () => {
  it('requires fields (login)', () => {
    const email = new FormControl('', [Validators.required, Validators.email]);
    expect(firstErrorKey(email)).toBeNull(); // untouched → no visible error yet
    email.markAsTouched();
    expect(firstErrorKey(email)).toBe('validation.required');
  });

  it('rejects invalid email', () => {
    const email = new FormControl('not-an-email', [Validators.required, Validators.email]);
    email.markAsTouched();
    expect(firstErrorKey(email)).toBe('validation.email');
  });

  it('flags short passwords with minLength', () => {
    const pw = new FormControl('123', [Validators.required, Validators.minLength(6)]);
    pw.markAsTouched();
    expect(firstErrorKey(pw)).toBe('validation.minLength');
  });

  it('detects password mismatch (register)', () => {
    const group = new FormGroup(
      {
        password: new FormControl('secret1'),
        confirmPassword: new FormControl('secret2'),
      },
      { validators: [passwordMatchValidator] },
    );
    expect(group.errors?.['passwordMismatch']).toBeTrue();
    group.get('confirmPassword')?.setValue('secret1');
    // Re-run validator manually since setValue triggers validation:
    expect(passwordMatchValidator(group)).toBeNull();
  });

  it('validates phone numbers (checkout)', () => {
    // E.164 from the country-code input, and legacy free-typed values.
    expect(phoneValidator(new FormControl('+420777123456'))).toBeNull();
    expect(phoneValidator(new FormControl('+201001234567'))).toBeNull();
    expect(phoneValidator(new FormControl('0100 123 4567'))).toBeNull();
    // Empty is allowed here; requiredness is enforced per form.
    expect(phoneValidator(new FormControl(''))).toBeNull();
    // Too short or not a number.
    expect(phoneValidator(new FormControl('+20'))).toEqual({ phone: true });
    expect(phoneValidator(new FormControl('abc'))).toEqual({ phone: true });
  });

  it('returns null for untouched controls', () => {
    const c = new FormControl('', [Validators.required]);
    expect(firstErrorKey(c)).toBeNull();
  });
});
