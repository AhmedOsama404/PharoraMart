import { Injectable, computed, signal } from '@angular/core';
import { delay, Observable, of, tap, throwError } from 'rxjs';
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '../../models/user.model';
import { environment } from '../../../environments/environment';
import { ApiClientService } from '../api/api-client.service';
import { CartStore } from './cart.store';
import { FavoritesStore } from './favorites.store';

const SESSION_KEY = 'novamart.session.v1';
const USERS_KEY = 'novamart.mock-users.v1';

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
      return this.api.post<AuthResponse>('auth/login', req).pipe(
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
      return throwError(() => ({ status: 401, message: 'invalid-credentials' })).pipe(delay(500));
    }
    const { password: _omit, ...user } = found;
    const auth: AuthResponse = { user, token: `mock.${user.id}.${Date.now()}` };
    this.session.set(auth);
    this.persist(auth);
    return of(auth).pipe(delay(600));
  }

  register(req: RegisterRequest): Observable<AuthResponse> {
    if (!environment.useMockApi) {
      return this.api.post<AuthResponse>('auth/register', req).pipe(
        tap((auth) => {
          this.session.set(auth);
          this.persist(auth);
        }),
      );
    }
    const email = req.email.trim().toLowerCase();
    const users = readUsers();
    if (users.some((u) => u.email.toLowerCase() === email)) {
      return throwError(() => ({ status: 409, message: 'email-taken' })).pipe(delay(500));
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

  /** Live-mode profile refresh (GET /auth/me); mock mode returns the session. */
  me(): Observable<User> {
    if (!environment.useMockApi) {
      return this.api.get<User>('auth/me');
    }
    const user = this.session()?.user;
    return user ? of(user) : throwError(() => ({ status: 401, message: 'unauthorized' }));
  }

  /** Demo password reset — never sends email; resolves after a delay. */
  requestPasswordReset(_email: string): Observable<{ ok: true }> {
    return of({ ok: true as const }).pipe(delay(700));
  }
}
