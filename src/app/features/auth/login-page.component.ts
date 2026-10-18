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
import { firstErrorKey } from '../../shared/utils/validators';

@Component({
  selector: 'app-login-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, Button, Card, InputText, Message, Password],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent implements OnInit {
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

  // Friendly explanation banner while a gated shopping action awaits sign-in.
  protected pendingReason = computed(() => this.pending.peek()?.reason ?? null);

  protected form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  // Keep the post-login destination when hopping between login/register.
  protected keepReturn() {
    const ret = this.route.snapshot.queryParamMap.get('returnUrl');
    return ret ? { returnUrl: ret } : {};
  }

  ngOnInit(): void {
    // Guests arrive here mid-scroll (e.g. add-to-cart gate on mobile):
    // start at the form, not the footer carried over from the last view.
    this.scroll.scrollToTop();
    // Already signed in (e.g. Back button after login): leave auth pages
    // instead of looping between login and register.
    if (this.auth.isLoggedIn()) {
      this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')));
    }
  }

  protected err(name: 'email' | 'password'): string | null {
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
    this.auth.login({ email: v.email, password: v.password }).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.notify.success('auth.loginSuccess', { name: res.user.name });
        this.completeSignIn();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        // One localized sentence from the backend's business code
        // (auth_invalid_credentials / too many attempts / offline) — shown
        // inline, so no extra toast is fired.
        this.serverError.set(this.apiError.message(err));
      },
    });
  }

  // Return to the stored destination (validated internal URL, never external)
  // and complete the gated shopping action exactly once, if there is one.
  private completeSignIn(): void {
    const intent = this.pending.consume();
    const url = safeReturnUrl(
      intent?.returnUrl ?? this.route.snapshot.queryParamMap.get('returnUrl'),
    );
    this.router.navigateByUrl(url).then(() => this.pending.runAction(intent?.action));
  }
}
