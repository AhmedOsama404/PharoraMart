import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from './auth.service';

describe('AuthService (mock)', () => {
  let svc: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(AuthService);
  });

  it('starts logged out', () => {
    expect(svc.isLoggedIn()).toBeFalse();
    expect(svc.user()).toBeNull();
  });

  it('registers then stays logged in (mock session only)', (done) => {
    svc.register({ name: 'Test User', email: 'test@example.com', password: 'secret12' }).subscribe((res) => {
      expect(res.user.email).toBe('test@example.com');
      expect(svc.isLoggedIn()).toBeTrue();
      done();
    });
  });

  it('rejects duplicate email registration', (done) => {
    svc.register({ name: 'A', email: 'dup@example.com', password: 'secret12' }).subscribe(() => {
      svc.register({ name: 'B', email: 'dup@example.com', password: 'secret12' }).subscribe({
        next: () => done.fail('should have errored'),
        error: () => done(),
      });
    });
  });

  it('logs in with correct credentials and out cleanly', (done) => {
    svc.register({ name: 'A', email: 'login@example.com', password: 'secret12' }).subscribe(() => {
      svc.logout();
      expect(svc.isLoggedIn()).toBeFalse();
      svc.login({ email: 'login@example.com', password: 'secret12' }).subscribe((res) => {
        expect(res.user.name).toBe('A');
        svc.logout();
        expect(svc.isLoggedIn()).toBeFalse();
        done();
      });
    });
  });

  it('rejects wrong password', (done) => {
    svc.register({ name: 'A', email: 'wrong@example.com', password: 'secret12' }).subscribe(() => {
      svc.logout();
      svc.login({ email: 'wrong@example.com', password: 'nope-nope' }).subscribe({
        next: () => done.fail('should have errored'),
        error: () => done(),
      });
    });
  });

  it('gives a generic success for password reset (no account disclosure)', (done) => {
    svc.requestPasswordReset('any@example.com').subscribe((res) => {
      expect(res.ok).toBeTrue();
      done();
    });
  });

  it('consumes reset and verification tokens generically', (done) => {
    svc.resetPassword({ token: 't', newPassword: 'secret12' }).subscribe((res) => {
      expect(res.ok).toBeTrue();
      svc.verifyEmail('t').subscribe((res2) => {
        expect(res2.ok).toBeTrue();
        svc.resendVerification('any@example.com').subscribe((res3) => {
          expect(res3.ok).toBeTrue();
          done();
        });
      });
    });
  });

  it('rejects a password change with the wrong current password', (done) => {
    svc.register({ name: 'A', email: 'cp@example.com', password: 'secret12' }).subscribe(() => {
      svc.changePassword({ currentPassword: 'nope-nope', newPassword: 'newpass34' }).subscribe({
        next: () => done.fail('should have errored'),
        error: (err) => {
          expect(err.code).toBe('auth_current_password_incorrect');
          done();
        },
      });
    });
  });

  it('changes password and accepts the new one on re-login', (done) => {
    svc.register({ name: 'A', email: 'cp2@example.com', password: 'secret12' }).subscribe(() => {
      svc.changePassword({ currentPassword: 'secret12', newPassword: 'newpass34' }).subscribe(() => {
        svc.logout();
        svc.login({ email: 'cp2@example.com', password: 'newpass34' }).subscribe((res) => {
          expect(res.user.email).toBe('cp2@example.com');
          done();
        });
      });
    });
  });
});

@Component({ selector: 'app-page-host', standalone: true, template: '' })
class PageHost {}

describe('AuthService.sessionExpired', () => {
  const seed = () =>
    localStorage.setItem(
      'novamart.session.v1',
      JSON.stringify({ user: { id: 'u-1', name: 'T', email: 't@example.com' }, token: 'dead' }),
    );

  function setup(): { svc: AuthService; router: Router } {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'orders', component: PageHost },
          { path: 'home', component: PageHost },
          { path: 'auth/login', component: PageHost },
        ]),
      ],
    });
    const router = TestBed.inject(Router);
    const svc = TestBed.inject(AuthService);
    return { svc, router };
  }

  it('signs the visitor out without touching the network', () => {
    seed();
    const { svc, router } = setup();
    expect(svc.isLoggedIn()).toBeTrue();

    svc.sessionExpired();

    expect(svc.isLoggedIn()).toBeFalse();
    expect(localStorage.getItem('novamart.session.v1')).toBeNull();
    expect(router.url).toBe('/');
  });

  it('returns to sign-in with the destination when on an account page', async () => {
    seed();
    const { svc, router } = setup();
    await router.navigate(['/orders']);
    expect(router.url).toContain('/orders');

    svc.sessionExpired();
    await new Promise((resolve) => setTimeout(resolve));

    expect(svc.isLoggedIn()).toBeFalse();
    expect(decodeURIComponent(router.url)).toBe('/auth/login?returnUrl=/orders');
  });

  it('lets public pages downgrade to guest with no redirect', async () => {
    seed();
    const { svc, router } = setup();
    await router.navigate(['/home']);

    svc.sessionExpired();
    await new Promise((resolve) => setTimeout(resolve));

    expect(svc.isLoggedIn()).toBeFalse();
    expect(router.url).toBe('/home');
  });
});
