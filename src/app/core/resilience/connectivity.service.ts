import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, NgZone, OnDestroy, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { isApiFailure, type ApiFailure } from './api-failure';

export type ConnectionStatus = 'online' | 'degraded' | 'offline';

/**
 * Small connectivity store. It combines the browser signal, failed-request
 * heuristics and a lightweight liveness probe, and emits `recovered$` when the
 * backend (or the network) comes back so screens can refetch without a reload.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityService implements OnDestroy {
  private readonly browserOnline = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  private readonly statusSignal = signal<ConnectionStatus>(this.browserOnline() ? 'online' : 'offline');
  private readonly lastSuccessAt = signal<number | null>(null);

  /** Fires whenever the app transitions from degraded/offline to online. */
  readonly recovered$ = new Subject<void>();

  readonly status = this.statusSignal.asReadonly();
  readonly isOnline = () => this.statusSignal() === 'online';
  readonly isOffline = () => this.statusSignal() === 'offline';
  readonly lastOnline = this.lastSuccessAt.asReadonly();

  private consecutiveFailures = 0;
  private probeAttempts = 0;
  private probeTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Array<() => void> = [];
  private destroyed = false;

  constructor(
    @Inject(DOCUMENT) private readonly doc: Document,
    private readonly zone: NgZone,
  ) {
    this.bindBrowserEvents();
  }

  /** Called by the API client after a successful response. */
  markSuccess(): void {
    this.consecutiveFailures = 0;
    this.probeAttempts = 0;
    this.lastSuccessAt.set(Date.now());
    this.browserOnline.set(true);
    if (this.statusSignal() !== 'online') {
      this.statusSignal.set('online');
      this.recovered$.next();
    }
    this.clearProbe();
  }

  /** Called by the API client after a classified failure. */
  markFailure(error: ApiFailure): void {
    this.consecutiveFailures += 1;
    if (error.kind === 'offline' || this.browserOnline() === false) {
      this.statusSignal.set('offline');
    } else if (error.kind === 'network' || error.kind === 'timeout' || error.kind === 'server') {
      this.statusSignal.set('degraded');
    } else {
      return;
    }
    this.scheduleProbe();
  }

  /** Force a probe now (tab focus, window online, Retry). */
  probe(): void {
    if (this.destroyed) return;
    const root = serverRoot(environment.apiBaseUrl);
    if (!root) return;
    this.clearProbe();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 3000) : null;
    fetch(`${root}/health/live`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller?.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`health ${res.status}`);
        this.zone.run(() => this.markSuccess());
      })
      .catch(() => {
        this.zone.run(() => {
          this.probeAttempts += 1;
          if (this.probeAttempts >= 2) {
            this.statusSignal.set(this.browserOnline() ? 'degraded' : 'offline');
          }
          this.scheduleProbe();
        });
      })
      .finally(() => {
        if (timer) clearTimeout(timer);
      });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.clearProbe();
    for (const off of this.listeners) off();
    this.listeners = [];
    this.recovered$.complete();
  }

  private bindBrowserEvents(): void {
    if (typeof window === 'undefined') return;
    const online = () => {
      this.browserOnline.set(true);
      this.probe();
    };
    const offline = () => {
      this.browserOnline.set(false);
      this.statusSignal.set('offline');
    };
    const focus = () => {
      if (this.statusSignal() !== 'online') this.probe();
    };
    const visibility = () => {
      if (this.doc.visibilityState === 'visible' && this.statusSignal() !== 'online') this.probe();
    };
    const add = (target: EventTarget, event: string, handler: EventListener) => {
      target.addEventListener(event, handler);
      this.listeners.push(() => target.removeEventListener(event, handler));
    };
    add(window, 'online', online);
    add(window, 'offline', offline);
    add(window, 'focus', focus);
    add(this.doc, 'visibilitychange', visibility);
    // A periodic probe only while unhealthy keeps an idle app quiet.
    const interval = setInterval(() => {
      if (this.statusSignal() !== 'online') this.probe();
    }, 20_000);
    this.listeners.push(() => clearInterval(interval));
  }

  private scheduleProbe(): void {
    if (this.destroyed || this.probeTimer) return;
    const delay = Math.min(30_000, 2_000 * 2 ** Math.min(this.probeAttempts, 4));
    this.probeTimer = setTimeout(() => {
      this.probeTimer = null;
      this.probe();
    }, delay);
  }

  private clearProbe(): void {
    if (this.probeTimer) {
      clearTimeout(this.probeTimer);
      this.probeTimer = null;
    }
  }
}

/** `https://host/api/v1` → `https://host`; health lives at the server root. */
export function serverRoot(apiBaseUrl: string): string {
  const base = apiBaseUrl.replace(/\/$/, '');
  return base.endsWith('/api/v1') ? base.slice(0, -'/api/v1'.length) : base;
}

/** Convenience type guard re-exported for components. */
export { isApiFailure };
