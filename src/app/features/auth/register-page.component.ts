import { ChangeDetectionStrategy, Component, computed, inject, signal, type OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { I18nService } from '../../core/services/i18n.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { PendingActionService, safeReturnUrl } from '../../core/services/pending-action.service';
import { ScrollService } from '../../core/services/scroll.service';
import { firstErrorKey, passwordMatchValidator, phoneValidator } from '../../shared/utils/validators';

@Component({
  selector: 'app-register-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, Button, Card, InputText, Message, Password],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.scss',
})
export class RegisterPageComponent implements OnInit {
  protected i18n = inject(I18nService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private apiError = inject(ApiErrorService);
  private notify = inject(NotificationService);
  private pending = inject(PendingActionService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private scroll = inject(ScrollService);

  protected busy = signal(false);
  protected serverError = signal('');

  // Friendly explanation banner while a gated shopping action awaits sign-up.
  protected pendingReason = computed(() => this.pending.peek()?.reason ?? null);

  protected form = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [phoneValidator]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [passwordMatchValidator] },
  );

  protected keepReturn() {
    const ret = this.route.snapshot.queryParamMap.get('returnUrl');
    return ret ? { returnUrl: ret } : {};
  }

  ngOnInit(): void {
    // Same as login: enter at the form, never mid-page from the last view.
    this.scroll.scrollToTop();
    // Already signed in: leave auth pages instead of looping login/register.
    if (this.auth.isLoggedIn()) {
      this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')));
    }
  }

  protected err(name: 'name' | 'email' | 'phone' | 'password'): string | null {
    return firstErrorKey(this.form.get(name));
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.serverError.set('');
    const v = this.form.getRawValue();
    this.auth.register({ name: v.name, email: v.email, password: v.password, phone: v.phone || undefined }).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.notify.success('auth.registerSuccess', { name: res.user.name });
        this.completeSignUp();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        // 409 (auth_email_taken) becomes "this email is already registered";
        // any other cause resolves to its own localized sentence.
        this.serverError.set(this.apiError.message(err));
      },
    });
  }

  // Same return-and-complete contract as login (see LoginPageComponent).
  private completeSignUp(): void {
    const intent = this.pending.consume();
    const url = safeReturnUrl(
      intent?.returnUrl ?? this.route.snapshot.queryParamMap.get('returnUrl'),
    );
    this.router.navigateByUrl(url).then(() => this.pending.runAction(intent?.action));
  }
}
