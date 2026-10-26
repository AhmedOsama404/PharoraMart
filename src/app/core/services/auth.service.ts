import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { delay, Observable, of, tap, throwError } from 'rxjs';
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '../../models/user.model';
import { environment } from '../../../environments/environment';
import { ApiClientService } from '../api/api-client.service';
import { CartStore } from './cart.store';
import { FavoritesStore } from './favorites.store';

const SESSION_KEY = 'novamart.session.v1';
const USERS_KEY = 'novamart.mock-users.v1';

/** Account routes a dead session cannot serve; expiry drops the user at sign-in. */
const ACCOUNT_ROUTES = ['/profile', '/orders', '/favorites', '/checkout'];

interface StoredSession {
  user: User;
  token: string;
}

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function readUsers(): (User & { password: string })[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? (arr as (User & { password: string })[]) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: (User & { password: string })[]): void {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    /* ignore */
  }
}

/**
 * Customer authentication. Mock mode keeps a demo session in localStorage;
 * live mode calls the backend (POST /auth/login|register, GET /auth/me).
 * accountSync (provided by AccountSyncService after login) pulls server
 * cart/favorites; logout clears local account state to prevent leaks.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private session = signal<StoredSession | null>(readSession());

  readonly user = computed(() => this.session()?.user ?? null);
  readonly isLoggedIn = computed(() => this.session() !== null);

  constructor(
    private api: ApiClientService,
    private router: Router,
    private cart: CartStore,
    private favorites: FavoritesStore,
  ) {}

  private persist(s: StoredSession | null): void {
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }

  login(req: LoginRequest): Observable<AuthResponse> {
    if (!environment.useMockApi) {
      // Auth pages render the failure inline next to the form, so the global
      // error toast stays quiet (no duplicate "something went wrong").
      return this.api.post<AuthResponse>('auth/login', req, undefined, { silent: true }).pipe(
        tap((auth) => {
          this.session.set(auth);
          this.persist(auth);
        }),
      );
    }
    const email = req.email.trim().toLowerCase();
    const users = readUsers();
    const found = users.find((u) => u.email.toLowerCase() === email);
    if (!found || found.password !== req.password) {
      // Same problem shape the live API returns, so both modes localize alike.
      return throwError(() => ({
        status: 401,
        code: 'auth_invalid_credentials',
        detail: 'Mock sign-in rejected: unknown email or wrong password.',
      })).pipe(delay(500));
    }
    const { password: _omit, ...user } = found;
    const auth: AuthResponse = { user, token: `mock.${user.id}.${Date.now()}` };
    this.session.set(auth);
    this.persist(auth);
    return of(auth).pipe(delay(600));
  }

  register(req: RegisterRequest): Observable<AuthResponse> {
    if (!environment.useMockApi) {
      return this.api.post<AuthResponse>('auth/register', req, undefined, { silent: true }).pipe(
        tap((auth) => {
          this.session.set(auth);
          this.persist(auth);
        }),
      );
    }
    const email = req.email.trim().toLowerCase();
    const users = readUsers();
    if (users.some((u) => u.email.toLowerCase() === email)) {
      return throwError(() => ({
        status: 409,
        code: 'auth_email_taken',
        detail: 'Mock sign-up rejected: email already registered.',
      })).pipe(delay(500));
    }
    const user: User = {
      id: `u-${Date.now().toString(36)}`,
      name: req.name.trim(),
      email: req.email.trim(),
      phone: req.phone?.trim() || undefined,
    };
    writeUsers([...users, { ...user, password: req.password }]);
    const auth: AuthResponse = { user, token: `mock.${user.id}.${Date.now()}` };
    this.session.set(auth);
    this.persist(auth);
    return of(auth).pipe(delay(700));
  }

  logout(): void {
    this.session.set(null);
    this.persist(null);
    // Account-scoped state must not leak to the next user on shared devices
    // (in-memory signals AND persisted copies; orders refetch per account).
    this.cart.clear();
    this.favorites.clear();
    try {
      localStorage.removeItem('novamart.orders.v1');
    } catch {
      /* ignore */
    }
  }

  /**
   * A stored token stopped being accepted (HTTP 401 on a request that carried
   * it). Reset session state exactly like a logout — the same user re-signs in
   * and the server still holds their cart/favorites, so nothing is lost — and
   * when the visitor is mid-journey on an account page, drop them at sign-in
   * with the destination preserved. Never calls the API; safe to invoke for
   * every failing request (it runs once, then the session is already null).
   */
  sessionExpired(): void {
    if (!this.session()) return;
    this.logout();
    const url = this.router.url;
    if (ACCOUNT_ROUTES.some((route) => url === route || url.startsWith(`${route}/`) || url.startsWith(`${route}?`))) {
      this.router.navigate(['/auth/login'], { queryParams: { returnUrl: url } });
    }
  }

  /**
   * Ask the server to start a password reset.
   *
   * The API answers 200 for every well-formed email (no account
   * disclosure), so the screen can say "if that address exists, we sent a
   * link" without leaking whether it does. This used to be a demo that
   * resolved locally and sent nothing at all.
   */
  requestPasswordReset(email: string): Observable<{ ok: true }> {
    if (!environment.useMockApi) {
      return this.api.post<{ ok: true }>(
        'auth/forgot-password',
        { email: email.trim() },
        undefined,
        { silent: true },
      );
    }
    // Mock mode: the same answer the live API gives, without an account.
    return of({ ok: true as const }).pipe(delay(700));
  }
}
