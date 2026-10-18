import { Injectable, signal } from '@angular/core';
import { ApiClientService } from '../api/api-client.service';

export interface ExchangeRateSnapshot {
  readonly baseCurrency: 'EUR';
  readonly date: string;
  readonly source: string;
  readonly rates: Readonly<Record<string, number>>;
}

@Injectable({ providedIn: 'root' })
export class ExchangeRatesService {
  readonly snapshot = signal<ExchangeRateSnapshot | null>(null);
  readonly loading = signal(false);
  readonly failed = signal(false);
  private requested = false;
  private scheduled = false;
  private retryAfter = 0;
  private refreshTimer: number | undefined;

  constructor(private api: ApiClientService) {}

  ensureLoaded(): void {
    if (this.loading() || this.scheduled || (this.requested && !this.failed())) return;
    if (this.failed() && Date.now() < this.retryAfter) return;
    // Price pipes can call this while Angular is rendering. Defer signal writes
    // and the HTTP request until that render pass has finished (NG0600).
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      if (this.loading() || (this.requested && !this.failed())) return;
      if (this.failed() && Date.now() < this.retryAfter) return;
      this.requested = true;
      this.loading.set(true);
      this.failed.set(false);
      this.api.get<ExchangeRateSnapshot>('store/exchange-rates').subscribe({
        next: (snapshot) => {
          const valid = snapshot?.baseCurrency === 'EUR' && ['EGP', 'USD', 'CZK'].every((code) =>
            Number.isFinite(snapshot.rates?.[code]) && snapshot.rates[code] > 0);
          if (valid) {
            this.snapshot.set(snapshot);
            this.retryAfter = 0;
            this.scheduleRefresh(6 * 60 * 60 * 1000);
          } else {
            this.failed.set(true);
            this.scheduleRefresh(15_000);
          }
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.scheduleRefresh(15_000);
          this.loading.set(false);
        },
      });
    });
  }

  retry(): void {
    this.requested = false;
    this.failed.set(false);
    this.retryAfter = 0;
    if (this.refreshTimer !== undefined) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
    this.ensureLoaded();
  }

  private scheduleRefresh(delayMs: number): void {
    if (this.refreshTimer !== undefined) window.clearTimeout(this.refreshTimer);
    this.retryAfter = Date.now() + delayMs;
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = undefined;
      this.requested = false;
      this.ensureLoaded();
    }, delayMs);
  }
}
