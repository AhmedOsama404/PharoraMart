import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, type OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { I18nService } from '../../core/services/i18n.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AuthService } from '../../core/services/auth.service';
import { ScrollService } from '../../core/services/scroll.service';
import { firstErrorKey, passwordMatchValidator } from '../../shared/utils/validators';

@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, Button, Card, Message, Password],
  templateUrl: './reset-password-page.component.html',
  styleUrl: './reset-password-page.component.scss',
})
export class ResetPasswordPageComponent implements OnInit {
  protected i18n = inject(I18nService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private apiError = inject(ApiErrorService);
  private scroll = inject(ScrollService);
  private route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected token = '';
  protected busy = signal(false);
  protected done = signal(false);
  protected serverError = signal('');

  protected form = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [passwordMatchValidator] },
  );

  ngOnInit(): void {
    this.scroll.scrollToTop();
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
  }

  /** The link has no token: nothing to submit, show an invalid-link state. */
  protected missingToken(): boolean {
    return this.token.trim().length === 0;
  }

  protected err(name: 'newPassword' | 'confirmPassword'): string | null {
    return firstErrorKey(this.form.get(name));
  }

  protected mismatch(): boolean {
    const confirm = this.form.get('confirmPassword');
    return !!this.form.errors?.['passwordMismatch'] && !!confirm && (confirm.touched || confirm.dirty);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.serverError.set('');
    this.auth
      .resetPassword({ token: this.token, newPassword: this.form.getRawValue().newPassword })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.done.set(true);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.serverError.set(this.apiError.message(err));
        },
      });
  }
}
