import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { I18nService } from '../../core/services/i18n.service';
import { AuthService } from '../../core/services/auth.service';
import { firstErrorKey } from '../../shared/utils/validators';

@Component({
  selector: 'app-forgot-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, Button, Card, InputText, Message],
  templateUrl: './forgot-page.component.html',
  styleUrl: './forgot-page.component.scss',
})
export class ForgotPageComponent {
  protected i18n = inject(I18nService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  protected busy = signal(false);
  protected sent = signal(false);
  protected form = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]] });

  protected err(): string | null {
    return firstErrorKey(this.form.get('email'));
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    // Demo only: resolves without sending any email (see the template notice).
    this.auth.requestPasswordReset(this.form.getRawValue().email).subscribe({
      next: () => {
        this.busy.set(false);
        this.sent.set(true);
      },
      error: () => this.busy.set(false),
    });
  }
}
