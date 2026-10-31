import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, type OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { I18nService } from '../../core/services/i18n.service';
import { AuthService } from '../../core/services/auth.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { ScrollService } from '../../core/services/scroll.service';
import { firstErrorKey } from '../../shared/utils/validators';

@Component({
  selector: 'app-forgot-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, Button, Card, InputText, Message],
  templateUrl: './forgot-page.component.html',
  styleUrl: './forgot-page.component.scss',
})
export class ForgotPageComponent implements OnInit {
  protected i18n = inject(I18nService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private apiError = inject(ApiErrorService);
  private scroll = inject(ScrollService);
  private readonly destroyRef = inject(DestroyRef);
  protected busy = signal(false);
  /** Set once the request succeeds: the response is generic either way. */
  protected sent = signal(false);
  /** A failed request must say so — a silent failure looks like success. */
  protected serverError = signal('');
  protected form = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]] });

  ngOnInit(): void {
    // Entered from auth links mid-page: start at the form.
    this.scroll.scrollToTop();
  }

  protected err(): string | null {
    return firstErrorKey(this.form.get('email'));
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.serverError.set('');
    this.auth
      .requestPasswordReset(this.form.getRawValue().email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.sent.set(true);
        },
        error: (err) => {
          this.busy.set(false);
          this.serverError.set(this.apiError.message(err));
        },
      });
  }
}
