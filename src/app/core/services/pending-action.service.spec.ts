import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { PendingActionService, safeReturnUrl } from './pending-action.service';
import { AuthService } from './auth.service';
import { CartStore } from './cart.store';
import { FavoritesStore } from './favorites.store';
import { NotificationService } from './notification.service';

describe('safeReturnUrl', () => {
  it('accepts internal paths with queries', () => {
    expect(safeReturnUrl('/products/abc?category=herbs')).toBe('/products/abc?category=herbs');
    expect(safeReturnUrl('/checkout')).toBe('/checkout');
  });

  it('rejects external, protocol-relative and escaped URLs', () => {
    expect(safeReturnUrl('https://evil.example/x')).toBe('/');
    expect(safeReturnUrl('//evil.example/x')).toBe('/');
    expect(safeReturnUrl('/\\evil')).toBe('/');
    expect(safeReturnUrl('javascript:alert(1)')).toBe('/');
    expect(safeReturnUrl(null)).toBe('/');
    expect(safeReturnUrl('')).toBe('/');
  });

  it('rejects auth-page loops', () => {
    expect(safeReturnUrl('/auth/login?returnUrl=/x')).toBe('/');
    expect(safeReturnUrl('/auth')).toBe('/');
  });
});

describe('PendingActionService', () => {
  let svc: PendingActionService;
  let auth: AuthService;
  let router: Router;
  let cart: CartStore;
  let favorites: FavoritesStore;
  const notices: string[] = [];

  beforeEach(() => {
    localStorage.clear();
    notices.length = 0;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: NotificationService,
          useValue: {
            success: (k: string) => notices.push('success:' + k),
            error: (k: string) => notices.push('error:' + k),
            info: (k: string) => notices.push('info:' + k),
          },
        },
      ],
    });
    svc = TestBed.inject(PendingActionService);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    cart = TestBed.inject(CartStore);
    favorites = TestBed.inject(FavoritesStore);
  });

  it('lets signed-in users straight through without storing anything', () => {
    // Simulate a session without async: log the test user in via mock register.
    return new Promise<void>((done) => {
      auth.register({ name: 'T', email: 't@t.t', password: 'secret12' }).subscribe(() => {
        const nav = spyOn(router, 'navigate');
        expect(svc.requireAuth('addToCart', '/products/x', { kind: 'add-to-cart', productId: 'x', qty: 1 })).toBeTrue();
        expect(svc.peek()).toBeNull();
        expect(nav).not.toHaveBeenCalled();
        done();
      });
    });
  });

  it('redirects guests to login with intent + explanation', () => {
    const nav = spyOn(router, 'navigate');
    const ok = svc.requireAuth('addToCart', '/products/karkadeh-hibiscus', {
      kind: 'add-to-cart',
      productId: 'karkadeh-hibiscus',
      qty: 2,
    });
    expect(ok).toBeFalse();
    expect(nav).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/products/karkadeh-hibiscus' },
    });
    expect(notices).toContain('info:gate.addToCart');
    const intent = svc.peek();
    expect(intent?.returnUrl).toBe('/products/karkadeh-hibiscus');
    expect(intent?.action).toEqual({ kind: 'add-to-cart', productId: 'karkadeh-hibiscus', qty: 2 });
  });

  it('consumes exactly once (no repeated execution)', () => {
    svc.request('/cart', 'checkout');
    expect(svc.consume()?.returnUrl).toBe('/cart');
    expect(svc.consume()).toBeNull();
  });

  it('completes add-to-favorite after sign-in with confirmation', () => {
    svc.runAction({ kind: 'add-to-favorite', productId: 'karkadeh-hibiscus' });
    expect(favorites.has('karkadeh-hibiscus')).toBeTrue();
    expect(notices).toContain('success:favorites.added');
  });

  it('completes add-to-cart clamped to live stock', (done) => {
    svc.runAction({ kind: 'add-to-cart', productId: 'karkadeh-hibiscus', qty: 500 });
    setTimeout(() => {
      expect(cart.count()).toBeGreaterThan(0);
      expect(cart.count()).toBeLessThanOrEqual(73);
      expect(notices).toContain('success:notifications.addedToCart');
      done();
    }, 600);
  });

  it('reports vanished products instead of adding broken lines', (done) => {
    svc.runAction({ kind: 'add-to-cart', productId: 'gone', qty: 1 });
    setTimeout(() => {
      expect(cart.isEmpty()).toBeTrue();
      expect(notices).toContain('error:errors.notFound');
      done();
    }, 600);
  });
});
