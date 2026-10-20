import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  TemplateRef,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Button } from 'primeng/button';
import { I18nService } from '../../core/services/i18n.service';
import { ErrorStateComponent } from './error-state.component';

export type BoundaryState = 'loading' | 'success' | 'empty' | 'error' | 'offline' | 'stale' | 'partial';

/**
 * One wrapper for every data-driven region. It owns the slow hint (3 s) and
 * renders exactly one state: LOADING, SUCCESS, EMPTY, ERROR, OFFLINE, STALE
 * (content plus a notice) or PARTIAL (content plus a notice). The hard
 * timeout lives in the API client, which turns a hung request into ERROR.
 */
@Component({
  selector: 'app-data-boundary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, Button, ErrorStateComponent],
  template: `
    @switch (state) {
      @case ('loading') {
        <div class="rs-boundary" aria-busy="true">
          <span class="rs-sr-only">{{ i18n.t('resilience.loading') }}</span>
          @if (skeleton) {
            <ng-container *ngTemplateOutlet="skeleton" />
          } @else {
            <div class="rs-skeleton-fallback" aria-hidden="true">
              <span class="rs-skeleton"></span>
              <span class="rs-skeleton"></span>
              <span class="rs-skeleton"></span>
            </div>
          }
          @if (slow()) {
            <div class="rs-slow" role="status">
              <i class="pi pi-clock" aria-hidden="true"></i>
              <div>
                <strong>{{ i18n.t('resilience.slowTitle') }}</strong>
                <span>{{ i18n.t('resilience.slowHint') }}</span>
              </div>
              <p-button
                [label]="i18n.t('resilience.retry')"
                icon="pi pi-refresh"
                severity="secondary"
                [text]="true"
                (onClick)="retry.emit()"
              />
            </div>
          }
        </div>
      }
      @case ('error') {
        <app-error-state [error]="error" [compact]="compact" [requestId]="requestId" (retry)="retry.emit()" />
      }
      @case ('offline') {
        <app-error-state
          [error]="error"
          kind="offline"
          [compact]="compact"
          [requestId]="requestId"
          (retry)="retry.emit()"
        />
      }
      @case ('empty') {
        @if (empty) {
          <ng-container *ngTemplateOutlet="empty" />
        } @else {
          <div class="rs-state rs-state--empty" role="status">
            <div class="rs-state__icon" aria-hidden="true"><i class="pi pi-inbox"></i></div>
            <div class="rs-state__copy">
              <h3>{{ i18n.t(emptyTitleKey) }}</h3>
              <p>{{ i18n.t(emptyBodyKey) }}</p>
            </div>
            @if (emptyActionLabelKey) {
              <div class="rs-state__actions">
                <p-button
                  [label]="i18n.t(emptyActionLabelKey)"
                  icon="pi pi-arrow-right"
                  (onClick)="emptyAction.emit()"
                />
              </div>
            }
          </div>
        }
      }
      @case ('stale') {
        <div class="rs-stale" role="status">
          <i class="pi pi-history" aria-hidden="true"></i>
          <span>{{ i18n.t(staleKey) }}</span>
          <button type="button" class="rs-link" (click)="retry.emit()">{{ i18n.t('resilience.retry') }}</button>
        </div>
        @if (content) { <ng-container *ngTemplateOutlet="content" /> }
      }
      @case ('partial') {
        <div class="rs-stale" role="status">
          <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
          <span>{{ i18n.t('resilience.partialTitle') }}</span>
          <button type="button" class="rs-link" (click)="retry.emit()">{{ i18n.t('resilience.retry') }}</button>
        </div>
        @if (content) { <ng-container *ngTemplateOutlet="content" /> }
      }
      @default {
        @if (content) { <ng-container *ngTemplateOutlet="content" /> }
      }
    }
  `,
})
export class DataBoundaryComponent implements OnDestroy {
  @Input({ required: true }) state: BoundaryState = 'loading';
  @Input() error: unknown = null;
  @Input() requestId: string | null = null;
  @Input() compact = false;
  @Input() slowAfterMs = 3000;
  @Input() emptyTitleKey = 'resilience.emptyTitle';
  @Input() emptyBodyKey = 'resilience.emptyBody';
  @Input() emptyActionLabelKey: string | null = null;
  @Input() staleKey = 'resilience.staleNotice';

  @ContentChild('skeleton') skeleton?: TemplateRef<unknown>;
  @ContentChild('content') content?: TemplateRef<unknown>;
  @ContentChild('empty') empty?: TemplateRef<unknown>;

  @Output() retry = new EventEmitter<void>();
  @Output() emptyAction = new EventEmitter<void>();

  readonly slow = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(public readonly i18n: I18nService) {}

  ngOnChanges(): void {
    if (this.state === 'loading') {
      if (!this.timer) {
        this.slow.set(false);
        this.timer = setTimeout(() => {
          this.slow.set(true);
          this.timer = null;
        }, Math.max(0, this.slowAfterMs));
      }
    } else {
      this.clearTimer();
      this.slow.set(false);
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
