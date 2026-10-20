import { ChangeDetectionStrategy, Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Subscription } from 'rxjs';
import { I18nService } from '../../core/services/i18n.service';
import { ConnectivityService } from '../../core/resilience/connectivity.service';

/**
 * Slim, non-blocking connection banner. It never shifts the layout (sticky),
 * auto-dismisses after recovery, and is announced politely to screen readers.
 */
@Component({
  selector: 'app-connection-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  template: `
    @if (visible()) {
      <div
        class="rs-connection"
        [class.rs-connection--ok]="justRecovered()"
        role="status"
        aria-live="polite"
      >
        <i class="pi" [class]="justRecovered() ? 'pi-check-circle' : connectivity.isOffline() ? 'pi-cloud' : 'pi-wifi'" aria-hidden="true"></i>
        <span>
          {{ justRecovered()
            ? i18n.t('resilience.backOnline')
            : connectivity.isOffline()
              ? i18n.t('resilience.offlineBanner')
              : i18n.t('resilience.connectionTrouble') }}
        </span>
        @if (!justRecovered()) {
          <button type="button" class="rs-link" (click)="connectivity.probe()">
            {{ i18n.t('resilience.reconnecting') }}
          </button>
        }
      </div>
    }
  `,
})
export class ConnectionBannerComponent implements OnDestroy {
  readonly i18n = inject(I18nService);
  readonly connectivity = inject(ConnectivityService);

  readonly visible = signal(false);
  readonly justRecovered = signal(false);
  private readonly sub: Subscription;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const status = this.connectivity.status();
      if (status === 'online') {
        if (!this.justRecovered()) this.visible.set(false);
      } else {
        this.justRecovered.set(false);
        this.visible.set(true);
      }
    });
    this.sub = this.connectivity.recovered$.subscribe(() => {
      this.justRecovered.set(true);
      this.visible.set(true);
      if (this.hideTimer) clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => {
        this.visible.set(false);
        this.justRecovered.set(false);
      }, 3500);
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    if (this.hideTimer) clearTimeout(this.hideTimer);
  }
}
