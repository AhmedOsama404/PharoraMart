import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
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

  it('simulates password reset without sending email', (done) => {
    svc.requestPasswordReset('any@example.com').subscribe((r) => {
      expect(r.ok).toBeTrue();
      done();
    });
  });
});
