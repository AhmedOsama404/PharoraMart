import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { PendingActionService } from '../services/pending-action.service';

@Component({ selector: 'app-guard-host', standalone: true, template: '' })
class HostComponent {}

describe('authGuard', () => {
  let auth: AuthService;
  let pending: PendingActionService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
        provideRouter([
          { path: 'favorites', component: HostComponent, canActivate: [authGuard] },
          { path: 'auth/login', component: HostComponent },
        ]),
      ],
    });
    auth = TestBed.inject(AuthService);
    pending = TestBed.inject(PendingActionService);
  });

  it('redirects guests to login and stores the return intent with a reason', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/favorites');
    expect(router.url).toContain('/auth/login');
    expect(pending.peek()?.returnUrl).toBe('/favorites');
    expect(pending.peek()?.reason).toBe('addToFavorites');
  });

  it('lets signed-in users through without storing an intent', async () => {
    await firstValueFrom(
      auth.register({ name: 'G', email: 'g@g.g', password: 'secret12' }),
    );
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/favorites');
    expect(router.url).toBe('/favorites');
    expect(pending.peek()).toBeNull();
  });
});
