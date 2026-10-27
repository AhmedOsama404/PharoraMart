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
  private readonly retryHooks = new Set<() => void>();
  private readonly recoverHooks = new Set<() => void>();
  private destroyed = false;
  /** Set while a liveness probe is on the wire; also aborts it on teardown. */
  private probeController: AbortController | null = null;

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
    const wasUnhealthy = this.statusSignal() !== 'online';
    if (wasUnhealthy) this.statusSignal.set('online');
    // Clear client-side gating BEFORE announcing recovery: screens refetch in
    // reaction to `recovered$`, and those requests must not meet a breaker
    // that is still cooling down.
    for (const hook of this.recoverHooks) hook();
    if (wasUnhealthy) this.recovered$.next();
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

  /** Registers a callback fired when a human explicitly asks to retry. */
  onRetry(hook: () => void): void {
    this.retryHooks.add(hook);
  }

  /**
   * Registers a callback fired whenever the backend is proven reachable again,
   * including by the background liveness probe. Used by the API client to
   * release its circuit breaker so recovery refetches are not rejected.
   */
  onRecover(hook: () => void): void {
    this.recoverHooks.add(hook);
  }

  /**
   * Explicit user Retry: clear client-side breaker state so the next request
   * is a real probe, and re-check backend health in parallel.
   */
  retryNow(): void {
    for (const hook of this.retryHooks) hook();
    this.probe();
  }

  /** Force a probe now (tab focus, window online, Retry). */
  probe(): void {
    // Hermetic unit tests enable mock mode: never touch the network.
    if (this.destroyed || environment.useMockApi) return;
    // One probe on the wire at a time. Focus, tab visibility, the periodic
    // retry and the user's Retry button all call this, and every raw fetch
    // takes one of the six HTTP/1.1 sockets the browser grants the API origin
    // — the same sockets the page's own data is queued behind.
    if (this.probeController) return;
    const root = serverRoot(environment.apiBaseUrl);
    if (!root) return;
    this.clearProbe();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    this.probeController = controller;
    // The probe is the only unsolicited recovery signal in the app, so it has
    // to be calibrated like the traffic it gates. It used to abort at 3 000 ms
    // while a data request is granted 10 000 ms per attempt: a local backend
    // that answers `/health/live` in 4 s — the normal IIS Express figure here,
    // measured — therefore failed its own health check, `markSuccess` never
    // ran, the circuit breaker was never released, and the storefront stayed
    // cut off from a server that was working. The data path's timeouts are
    // untouched; this ceiling only governs the check.
    const probeMs = Math.max(1_000, environment.livenessProbeTimeoutMs ?? 8_000);
    const timer = controller ? setTimeout(() => controller.abort(), probeMs) : null;
    fetch(`${root}/health/live`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller?.signal,
    })
      .then((res) => {
        this.zone.run(() => {
          if (res.ok) {
            this.markSuccess();
            return;
          }
          // The server ANSWERED, so the connection is not lost. An unhealthy
          // 503 backs off without overwriting the status the data path
          // reported: blaming the network for the API's own problem would
          // suppress the error the shopper needs to see.
          this.probeAttempts += 1;
          this.scheduleProbe();
        });
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
        if (controller && this.probeController === controller) this.probeController = null;
      });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    // A probe still on the wire would otherwise call back into a dead store.
    this.probeController?.abort();
    this.probeController = null;
    this.clearProbe();
    for (const off of this.listeners) off();
    this.listeners = [];
    this.recovered$.complete();
  }

  private bindBrowserEvents(): void {
    if (typeof window === 'undefined' || environment.useMockApi) return;
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
