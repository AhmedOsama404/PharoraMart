import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { I18nService } from '../../core/services/i18n.service';
import type { ApiErrorKind } from '../../core/resilience/api-failure';

export type ErrorStateKind = ApiErrorKind | 'offline';

interface ErrorCopy {
  readonly title: string;
  readonly body: string;
  readonly icon: string;
}

const COPY: Record<ApiErrorKind, ErrorCopy> = {
  network: { title: 'resilience.networkTitle', body: 'resilience.networkBody', icon: 'pi-wifi' },
  offline: { title: 'resilience.offlineTitle', body: 'resilience.offlineBody', icon: 'pi-cloud' },
  timeout: { title: 'resilience.timeoutTitle', body: 'resilience.timeoutBody', icon: 'pi-clock' },
  server: { title: 'resilience.serverTitle', body: 'resilience.serverBody', icon: 'pi-server' },
  rate_limited: { title: 'resilience.rateTitle', body: 'resilience.rateBody', icon: 'pi-hourglass' },
  unauthorized: { title: 'resilience.unauthorizedTitle', body: 'resilience.unauthorizedBody', icon: 'pi-lock' },
  forbidden: { title: 'resilience.forbiddenTitle', body: 'resilience.forbiddenBody', icon: 'pi-ban' },
  not_found: { title: 'resilience.notFoundTitle', body: 'resilience.notFoundBody', icon: 'pi-search' },
  validation: { title: 'resilience.validationTitle', body: 'resilience.validationBody', icon: 'pi-exclamation-circle' },
  parse: { title: 'resilience.genericTitle', body: 'resilience.genericBody', icon: 'pi-exclamation-triangle' },
  unknown: { title: 'resilience.genericTitle', body: 'resilience.genericBody', icon: 'pi-exclamation-triangle' },
};

/**
 * Friendly failure surface. Never renders server prose or stack traces —
 * only localized copy plus a copyable support reference.
 */
@Component({
  selector: 'app-error-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, RouterLink],
  template: `
    <div class="rs-state rs-state--error" [class.rs-state--compact]="compact" role="alert">
      <div class="rs-state__icon" aria-hidden="true"><i class="pi" [class]="copy.icon"></i></div>
      <div class="rs-state__copy">
        <h3>{{ i18n.t(titleKey ?? copy.title) }}</h3>
        @if (!compact) {
          <p>{{ i18n.t(bodyKey ?? copy.body) }}</p>
        }
        @if (requestId) {
          <p class="rs-state__ref">
            <span>{{ i18n.t('resilience.reference', { id: requestId }) }}</span>
            <button type="button" class="rs-link" (click)="copyRef()">
              {{ copied ? i18n.t('resilience.copied') : i18n.t('resilience.copyReference') }}
            </button>
          </p>
        }
      </div>
      <div class="rs-state__actions">
        @if (retryable) {
          <p-button
            [label]="i18n.t('resilience.retry')"
            icon="pi pi-refresh"
            (onClick)="retry.emit()"
          />
        }
        @if (showHome) {
          <a class="rs-state__home" routerLink="/">{{ i18n.t('resilience.goHome') }}</a>
        }
      </div>
    </div>
  `,
})
export class ErrorStateComponent {
  @Input() error: unknown = null;
  @Input() kind: ErrorStateKind | null = null;
  @Input() titleKey: string | null = null;
  @Input() bodyKey: string | null = null;
  @Input() requestId: string | null = null;
  @Input() compact = false;
  @Input() showHome = false;
  @Input() retryable = true;
  @Output() retry = new EventEmitter<void>();

  copied = false;

  constructor(public readonly i18n: I18nService) {}

  get copy(): ErrorCopy {
    const resolved = this.kind ?? kindOf(this.error);
    return COPY[resolved] ?? COPY.unknown;
  }

  protected copyRef(): void {
    if (!this.requestId) return;
    const done = () => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    };
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(this.requestId).then(done).catch(done);
    } else {
      done();
    }
  }
}

function kindOf(error: unknown): ApiErrorKind {
  if (error && typeof error === 'object' && 'kind' in error) {
    const kind = (error as { kind?: unknown }).kind;
    if (typeof kind === 'string' && kind in COPY) return kind as ApiErrorKind;
  }
  return 'unknown';
}
