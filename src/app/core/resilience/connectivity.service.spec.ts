import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ApiFailure } from './api-failure';
import { ConnectivityService } from './connectivity.service';

/**
 * The liveness probe is the only signal that clears the circuit breaker without
 * a human pressing Retry, so its calibration decides whether the storefront
 * recovers on its own. These specs pin the two ways it used to fail a healthy
 * backend: an abort far tighter than the data requests it gates, and a health
 * endpoint that answered badly being read as a lost connection.
 */
describe('ConnectivityService liveness probe', () => {
  const PROBE_CEILING = environment.livenessProbeTimeoutMs ?? 8_000;

  let service: ConnectivityService;
  let fetchSpy: jasmine.Spy;
  let originalUseMockApi: boolean;

  /** A transport-shaped failure of the kind the API client reports. */
  const timeoutFailure = (): ApiFailure =>
    new ApiFailure({
      status: 0,
      kind: 'timeout',
      retryable: true,
      messageKey: 'resilience.timeoutTitle',
      requestId: 'req-test',
    });

  /** Lets the stubbed promise chain run to completion. */
  async function settle(): Promise<void> {
    for (let i = 0; i < 4; i += 1) await Promise.resolve();
  }

  beforeEach(() => {
    originalUseMockApi = environment.useMockApi;
    // The probe is a live-path feature and stands down in mock mode.
    environment.useMockApi = false;
    jasmine.clock().install();
    fetchSpy = spyOn(globalThis, 'fetch').and.callFake(() => new Promise(() => {}));
    TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: document }] });
    service = TestBed.inject(ConnectivityService);
  });

  afterEach(() => {
    // Destroy the service while the fake clock is STILL installed. Its
    // constructor starts a 20 s `setInterval` and `scheduleProbe` starts a
    // `setTimeout`, both minted by Jasmine's mock; `ngOnDestroy` clears them
    // with whichever `clearInterval`/`clearTimeout` are current at that
    // moment. Uninstalling first hands those mock ids to the real, zone-patched
    // functions, where they collide with a later spec's own timers — that spec
    // then dies with an uncaught "executing a cancelled action" and a 20 s
    // timeout, in a file that has nothing to do with this one. Because the
    // suite runs in random order, the victims change from run to run.
    service.ngOnDestroy();
    TestBed.resetTestingModule();
    jasmine.clock().uninstall();
    environment.useMockApi = originalUseMockApi;
  });

  it('gives the health check the same grace as the requests it unlocks', () => {
    let signal: AbortSignal | undefined;
    fetchSpy.and.callFake((_url: unknown, init?: { signal?: AbortSignal }) => {
      signal = init?.signal;
      return new Promise(() => {});
    });

    service.probe();
    expect(signal?.aborted).toBeFalse();

    // The old ceiling was 3 000 ms while a data request is granted 10 000 ms.
    jasmine.clock().tick(5_000);
    expect(signal?.aborted).toBeFalse();

    jasmine.clock().tick(PROBE_CEILING - 5_000 + 1);
    expect(signal?.aborted).toBeTrue();
  });

  it('releases the client-side gating when a slow health answer proves the server is up', async () => {
    let recovered = false;
    let hookRan = false;
    service.recovered$.subscribe(() => (recovered = true));
    service.onRecover(() => (hookRan = true));

    let respond!: (res: { ok: boolean; status: number }) => void;
    fetchSpy.and.callFake(() => new Promise<{ ok: boolean; status: number }>((resolve) => (respond = resolve)));

    service.markFailure(timeoutFailure());
    expect(service.status()).toBe('degraded');

    service.probe();
    jasmine.clock().tick(5_000);
    respond({ ok: true, status: 200 });
    await settle();

    expect(service.status()).toBe('online');
    expect(hookRan).toBeTrue();
    expect(recovered).toBeTrue();
  });

  it('does not call a 503 from a live server a lost connection', async () => {
    let respond!: (res: { ok: boolean; status: number }) => void;
    fetchSpy.and.callFake(() => new Promise<{ ok: boolean; status: number }>((resolve) => (respond = resolve)));

    for (let attempt = 0; attempt < 2; attempt += 1) {
      service.probe();
      respond({ ok: false, status: 503 });
      await settle();
    }

    // Two failed checks used to be enough to flip the app to `degraded` while
    // the server was, in fact, answering. Data failures still drive the status.
    expect(service.status()).toBe('online');
    expect(fetchSpy.calls.count()).toBe(2);
  });

  it('keeps the recovery hooks ahead of the announcement so refetches are not gated', () => {
    const order: string[] = [];
    service.onRecover(() => order.push('hook'));
    service.recovered$.subscribe(() => order.push('announced'));

    service.markFailure(timeoutFailure());
    service.markSuccess();

    expect(order).toEqual(['hook', 'announced']);
  });
});
