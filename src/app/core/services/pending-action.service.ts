import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ProductService } from './product.service';
import { CartStore } from './cart.store';
import { FavoritesStore } from './favorites.store';
import { NotificationService } from './notification.service';
import { environment } from '../../../environments/environment';

// Reasons double as `gate.*` translation keys for the friendly explanation.
export type GateReason = 'addToCart' | 'addToFavorites' | 'checkout' | 'account';

// A shopping action a guest attempted before signing in. Stored once, executed
// at most once after authentication — never silently dropped, never repeated.
export type PendingShoppingAction =
  | { kind: 'add-to-cart'; productId: string; qty: number; variantKey?: string; variantLabel?: string }
  | { kind: 'add-to-favorite'; productId: string };

export interface ReturnIntent {
  /** Validated internal path to return to after sign-in. */
  returnUrl: string;
  /** Why authentication was required (drives the localized explanation). */
  reason: GateReason;
  /** Optional shopping action completed once on arrival. */
  action?: PendingShoppingAction;
}

/**
 * Typed return-intent store for the guest → sign-in → continue journey.
 * Browsing stays public; cart/favorites/checkout/account routes go through
 * here so the original destination (and the intended click) survives login.
 */
@Injectable({ providedIn: 'root' })
export class PendingActionService {
  private intent = signal<ReturnIntent | null>(null);

  readonly pending = this.intent.asReadonly();

  request(returnUrl: string, reason: GateReason, action?: PendingShoppingAction): void {
    this.intent.set({ returnUrl: safeReturnUrl(returnUrl), reason, action });
  }

  peek(): ReturnIntent | null {
    return this.intent();
  }

  /** Exactly-once handoff: returns the intent and clears it. */
  consume(): ReturnIntent | null {
    const current = this.intent();
    this.intent.set(null);
    return current;
  }

  clear(): void {
    this.intent.set(null);
  }

  /**
   * Runs the stored shopping action after a successful sign-in. Called once by
   * the login/registration pages after navigating to the return URL, so the
   * confirmation toast appears in context on the destination page.
   */
  runAction(action: PendingShoppingAction | undefined): void {
    if (!action) return;
    if (action.kind === 'add-to-favorite') {
      this.favorites.add(action.productId);
      this.notify.success('favorites.added');
      return;
    }
    // add-to-cart: re-resolve the product so quantity clamps to live stock and
    // vanished products produce a friendly error instead of a broken line.
    this.products.getById(action.productId).subscribe({
      next: (p) => {
        if (p.stock <= 0) {
          this.notify.error('product.outOfStock');
          return;
        }
        this.cart.add(p.id, action.qty, action.variantKey, action.variantLabel, p.stock);
        this.notify.success('notifications.addedToCart');
      },
      error: () => {
        // Live mode: the global interceptor already surfaced the localized
        // reason exactly once. Mock mode never touches HTTP, so explain here.
        if (environment.useMockApi) this.notify.error('errors.notFound');
      },
    });
  }

  constructor(
    private products: ProductService,
    private cart: CartStore,
    private favorites: FavoritesStore,
    private notify: NotificationService,
    private router: Router,
    private auth: AuthService,
  ) {}

  /** Localized friendly explanation for why sign-in was required. */
  explain(reason: GateReason): void {
    this.notify.info(`gate.${reason}`);
  }

  /**
   * Call at the top of an account-required click handler. Returns true when
   * signed in (caller proceeds); otherwise stores the intent, explains why,
   * redirects to login and returns false (caller must stop).
   */
  requireAuth(reason: GateReason, returnUrl: string, action?: PendingShoppingAction): boolean {
    if (this.auth.isLoggedIn()) return true;
    this.request(returnUrl, reason, action);
    this.explain(reason);
    this.router.navigate(['/auth/login'], { queryParams: { returnUrl: safeReturnUrl(returnUrl) } });
    return false;
  }
}

/**
 * Internal return URLs only. Rejects protocol-relative URLs, backslashes,
 * schemes and auth-page loops so a crafted `returnUrl` can neither leave the
 * app nor bounce between login and register forever.
 */
export function safeReturnUrl(raw: string | null | undefined, fallback = '/'): string {
  if (!raw || typeof raw !== 'string') return fallback;
  const url = raw.trim();
  if (!url.startsWith('/') || url.startsWith('//') || url.includes('\\')) return fallback;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) return fallback;
  if (url.startsWith('/auth/') || url === '/auth') return fallback;
  return url || fallback;
}
