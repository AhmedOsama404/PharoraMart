import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, type OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { I18nService } from '../../core/services/i18n.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AuthService } from '../../core/services/auth.service';
import { ScrollService } from '../../core/services/scroll.service';
import { firstErrorKey } from '../../shared/utils/validators';

@Component({
  selector: 'app-verify-email-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, Button, Card, InputText, Message],
  templateUrl: './verify-email-page.component.html',
  styleUrl: './verify-email-page.component.scss',
})
export class VerifyEmailPageComponent implements OnInit {
  protected i18n = inject(I18nService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private apiError = inject(ApiErrorService);
  private scroll = inject(ScrollService);
  private route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected token = '';
  protected state = signal<'verifying' | 'verified' | 'failed'>('verifying');
  protected serverError = signal('');
  protected resendBusy = signal(false);
  protected resent = signal(false);

  protected resendForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  ngOnInit(): void {
    this.scroll.scrollToTop();
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (this.token.trim().length === 0) {
      this.state.set('failed');
      return;
    }
    this.auth
      .verifyEmail(this.token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.state.set('verified'),
        error: (err: unknown) => {
          this.state.set('failed');
          this.serverError.set(this.apiError.message(err));
        },
      });
  }

  protected resendErr(): string | null {
    return firstErrorKey(this.resendForm.get('email'));
  }

  protected resend(): void {
    if (this.resendForm.invalid) {
      this.resendForm.markAllAsTouched();
      return;
    }
    this.resendBusy.set(true);
    this.auth
      .resendVerification(this.resendForm.getRawValue().email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.resendBusy.set(false);
          this.resent.set(true);
        },
        error: () => {
          this.resendBusy.set(false);
          // Generic either way: never reveal whether the email exists.
          this.resent.set(true);
        },
      });
  }
}
