import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, type OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import { I18nService } from '../../core/services/i18n.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { MessagesService } from '../../core/services/messages.service';
import { ScrollService } from '../../core/services/scroll.service';
import { firstErrorKey, phoneValidator } from '../../shared/utils/validators';
import { PhoneInputComponent } from '../../shared/components/phone-input.component';

/**
 * Customer contact form. Submits to the backend inbox (`POST api/v1/messages`)
 * and renders its own inline success and error states — no global toast, so a
 * network failure reads as an offline sentence rather than a generic error.
 * The submit button is disabled while a request is in flight, preventing
 * duplicate submissions from a double-click.
 */
@Component({
  selector: 'app-contact-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Button, Card, InputText, Message, Textarea, PhoneInputComponent],
  templateUrl: './contact-page.component.html',
  styleUrl: './contact-page.component.scss',
})
export class ContactPageComponent implements OnInit {
  protected i18n = inject(I18nService);
  private fb = inject(FormBuilder);
  private messages = inject(MessagesService);
  private apiError = inject(ApiErrorService);
  private scroll = inject(ScrollService);
  private readonly destroyRef = inject(DestroyRef);

  protected busy = signal(false);
  protected sent = signal(false);
  protected serverError = signal('');

  protected form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(320)]],
    phone: ['', [phoneValidator, Validators.maxLength(50)]],
    subject: ['', [Validators.maxLength(300)]],
    body: ['', [Validators.required, Validators.maxLength(5000)]],
  });

  ngOnInit(): void {
    this.scroll.scrollToTop();
  }

  /** Resolved, localized error text for a field ("" = valid or untouched). */
  protected error(name: 'name' | 'email' | 'phone' | 'subject' | 'body'): string {
    const control = this.form.get(name);
    const key = firstErrorKey(control);
    if (!key) return '';
    if (key === 'validation.maxLength') {
      const max = control?.errors?.['maxlength']?.requiredLength;
      return this.i18n.t(key, max ? { max } : undefined);
    }
    return this.i18n.t(key);
  }

  protected submit(): void {
    if (this.busy() || this.form.invalid) {
      if (this.form.invalid) this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.serverError.set('');
    const v = this.form.getRawValue();
    this.messages
      .submit({
        name: v.name,
        email: v.email,
        phone: v.phone || undefined,
        subject: v.subject || undefined,
        body: v.body,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.sent.set(true);
          this.form.reset();
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.serverError.set(this.apiError.message(err));
        },
      });
  }

  /** Clear the success banner and let the visitor write another message. */
  protected sendAnother(): void {
    this.sent.set(false);
    this.serverError.set('');
  }
}
