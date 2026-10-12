import { Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';
import { I18nService } from './i18n.service';

export type ToastKind = 'success' | 'info' | 'warn' | 'error';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  // Collapse exact repeats inside this window (rapid double-taps): one
  // logical action shows one toast. Distinct messages always pass, so real
  // errors are never hidden — only identical back-to-back repeats are dropped.
  private static readonly DEDUP_WINDOW_MS = 1200;
  private last: { key: string; at: number } | null = null;

  constructor(
    private messages: MessageService,
    private i18n: I18nService,
  ) {}

  show(kind: ToastKind, summaryKey: string, detail?: string, params?: Record<string, string | number>): void {
    const key = `${kind}|${summaryKey}|${detail ?? ''}|${JSON.stringify(params ?? {})}`;
    const now = Date.now();
    if (this.last && this.last.key === key && now - this.last.at < NotificationService.DEDUP_WINDOW_MS) {
      return;
    }
    this.last = { key, at: now };
    this.messages.add({
      severity: kind,
      summary: this.i18n.t(summaryKey, params),
      detail: detail ?? '',
      life: kind === 'error' ? 5000 : 3000,
    });
  }

  success(summaryKey: string, params?: Record<string, string | number>): void {
    this.show('success', summaryKey, undefined, params);
  }

  error(summaryKey: string, params?: Record<string, string | number>): void {
    this.show('error', summaryKey, undefined, params);
  }

  info(summaryKey: string, params?: Record<string, string | number>): void {
    this.show('info', summaryKey, undefined, params);
  }

  raw(kind: ToastKind, summary: string, detail = ''): void {
    const key = `${kind}|raw|${summary}|${detail}`;
    const now = Date.now();
    if (this.last && this.last.key === key && now - this.last.at < NotificationService.DEDUP_WINDOW_MS) {
      return;
    }
    this.last = { key, at: now };
    this.messages.add({ severity: kind, summary, detail, life: 3500 });
  }

  clear(): void {
    this.last = null;
    this.messages.clear();
  }
}
