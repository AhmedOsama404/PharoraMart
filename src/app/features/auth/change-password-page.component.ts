import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, type OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { I18nService } from '../../core/services/i18n.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { ScrollService } from '../../core/services/scroll.service';
import { firstErrorKey, passwordMatchValidator } from '../../shared/utils/validators';

@Component({
  selector: 'app-change-password-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Button, Card, Message, Password],
  templateUrl: './change-password-page.component.html',
  styleUrl: './change-password-page.component.scss',
})
export class ChangePasswordPageComponent implements OnInit {
  protected i18n = inject(I18nService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private apiError = inject(ApiErrorService);
  private notify = inject(NotificationService);
  private scroll = inject(ScrollService);
  private router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected busy = signal(false);
  protected serverError = signal('');

  protected form = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [passwordMatchValidator] },
  );

  ngOnInit(): void {
    this.scroll.scrollToTop();
  }

  protected err(name: 'currentPassword' | 'newPassword' | 'confirmPassword'): string | null {
    return firstErrorKey(this.form.get(name));
  }

  protected mismatch(): boolean {
    const confirm = this.form.get('confirmPassword');
    return !!this.form.errors?.['passwordMismatch'] && !!confirm && (confirm.touched || confirm.dirty);
  }

  protected cancel(): void {
    this.router.navigate(['/auth/profile']);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.serverError.set('');
    const v = this.form.getRawValue();
    this.auth
      .changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.notify.success('auth.changePasswordSuccess');
          this.router.navigate(['/auth/profile']);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.serverError.set(this.apiError.message(err));
        },
      });
  }
}
