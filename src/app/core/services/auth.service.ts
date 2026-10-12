import { Injectable, computed, signal } from '@angular/core';
import { delay, Observable, of, throwError } from 'rxjs';
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '../../models/user.model';

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
 * Mock authentication — clearly NOT real or secure.
 * Keeps a demo session in localStorage so guests can shop freely and the
 * UI flow (login/register/profile/orders) works end to end. Swap with the
 * HTTP implementation described in docs/API_CONTRACT.md without touching UI.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private session = signal<StoredSession | null>(readSession());

  readonly user = computed(() => this.session()?.user ?? null);
  readonly isLoggedIn = computed(() => this.session() !== null);

  private persist(s: StoredSession | null): void {
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }

  login(req: LoginRequest): Observable<AuthResponse> {
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
  }

  /** Demo password reset — never sends email; resolves after a delay. */
  requestPasswordReset(_email: string): Observable<{ ok: true }> {
    return of({ ok: true as const }).pipe(delay(700));
  }
}
