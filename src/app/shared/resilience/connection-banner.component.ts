import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, effect, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { I18nService } from '../../core/services/i18n.service';
import { ConnectivityService } from '../../core/resilience/connectivity.service';

/**
 * Slim, non-blocking connection banner. It never shifts the layout (sticky),
 * auto-dismisses after recovery, and is announced politely to screen readers.
 *
 * The banner and the header are both sticky, so the banner publishes its own
 * height as `--rs-banner-h`: the header then parks right below it instead of
 * painting over its top edge.
 */
@Component({
  selector: 'app-connection-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Angular components are `display: inline` unless told otherwise, and that
  // broke this banner twice over: Chrome's ResizeObserver skips inline boxes,
  // so the height published for the header stayed at 0px forever, and a sticky
  // child inside a parent exactly its own height has no range to travel in, so
  // the banner — and its Retry link — scrolled away. The host carries the
  // stickiness instead, against the page-height layout root.
  styles: [
    `
      :host {
        display: block;
        position: sticky;
        top: 0;
        z-index: 900;
      }
    `,
  ],
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
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly visible = signal(false);
  readonly justRecovered = signal(false);
  private readonly sub: Subscription;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private observer: ResizeObserver | null = null;

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
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.publishHeight());
      this.observer.observe(this.host.nativeElement);
    }
  }

  /** Lets the sticky header park exactly below the banner. */
  private publishHeight(): void {
    const height = this.host.nativeElement.offsetHeight;
    document.documentElement.style.setProperty('--rs-banner-h', `${height}px`);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.observer?.disconnect();
    document.documentElement.style.removeProperty('--rs-banner-h');
  }
}
