import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { apiInterceptor, resetExpiryNoticeStateForTests } from './api.interceptor';
import { AuthService } from '../services/auth.service';
import { I18nService } from '../services/i18n.service';

const SESSION_KEY = 'novamart.session.v1';

function seedSession(token = 'stale-token'): void {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ user: { id: 'u-1', name: 'Test', email: 't@example.com' }, token }),
  );
}

describe('apiInterceptor (session expiry)', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let messages: MessageService;
  let i18n: I18nService;
  let auth!: AuthService;
  let addSpy: jasmine.Spy;

  beforeEach(() => {
    localStorage.clear();
    resetExpiryNoticeStateForTests();
    TestBed.configureTestingModule({
      providers: [
        MessageService,
        provideRouter([]),
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    messages = TestBed.inject(MessageService);
    i18n = TestBed.inject(I18nService);
    addSpy = spyOn(messages, 'add').and.callThrough();
  });

  afterEach(() => backend.verify());

  const toastSummaries = () =>
    addSpy.calls.all().map((call) => (call.args[0] as { summary: string }).summary);

  /**
   * Re-attaches the (still dead) token to requests, as live bursts do, and
   * fails both account reads with 401. AuthService must be constructed AFTER
   * the seed — it reads the saved session on boot.
   */
  function expireBurst(): void {
    seedSession();
    auth = TestBed.inject(AuthService);
    const cart = http.get('/x/cart').subscribe({ error: () => undefined });
    const favs = http.get('/x/favorites').subscribe({ error: () => undefined });
    backend.expectOne('/x/cart').flush({ code: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/x/favorites').flush({ code: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    expect(cart.closed).toBeTrue();
    expect(favs.closed).toBeTrue();
  }

  it('clears the stale session once and explains once for a burst of failures', () => {
    expireBurst();

    // One localized notice, not one per failing request…
    expect(toastSummaries()).toEqual([i18n.t('errors.sessionExpired')]);
    // …and the app is honestly signed-out right away.
    expect(auth.isLoggedIn()).toBeFalse();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('stops attaching the dead token to later requests', () => {
    seedSession();
    auth = TestBed.inject(AuthService);
    expect(auth.isLoggedIn()).toBeTrue();

    http.get('/x/cart').subscribe({ error: () => undefined });
    backend
      .expectOne((req) => req.url === '/x/cart' && req.headers.has('Authorization'))
      .flush({ code: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    http.get('/x/products').subscribe({ error: () => undefined });
    const next = backend.expectOne('/x/products');
    expect(next.request.headers.has('Authorization')).toBeFalse();
    next.flush([]);
  });

  it('treats sign-in failures as wrong credentials, never session expiry', () => {
    seedSession();
    auth = TestBed.inject(AuthService);
    expect(auth.isLoggedIn()).toBeTrue();

    http.post('/x/auth/login', {}).subscribe({ error: () => undefined });
    backend
      .expectOne('/x/auth/login')
      .flush({ code: 'auth_invalid_credentials' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isLoggedIn()).toBeTrue();
    expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();
    expect(toastSummaries()).toEqual([i18n.t('errors.invalidCredentials')]);
  });

  it('stays quiet within the cooldown even when more failing requests return', () => {
    expireBurst();
    expect(toastSummaries()).toEqual([i18n.t('errors.sessionExpired')]);
    expect(auth.isLoggedIn()).toBeFalse();

    // The same burst's later requests re-attach a still-dead token (only the
    // notice state was marked); the visitor hears one message, not one per
    // failing call.
    seedSession('stale-token-2');
    http.get('/x/orders').subscribe({ error: () => undefined });
    backend.expectOne('/x/orders').flush({ code: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    expect(toastSummaries()).toEqual([i18n.t('errors.sessionExpired')]);
  });
});
