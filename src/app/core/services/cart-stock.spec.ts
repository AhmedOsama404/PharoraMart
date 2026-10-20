import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AccountSyncService } from './account-sync.service';
import { ApiClientService } from '../api/api-client.service';
import { AuthService } from './auth.service';
import { CartStore } from './cart.store';
import { CartViewService } from './cart-view.service';
import { ProductService } from './product.service';
import { MOCK_PRODUCTS } from '../../data-access/mock-data';
import { hermeticApi } from '../../../testing/hermetic-api';

/**
 * The cart must never hold more than the live stock, and pulling the
 * account cart must never make the quantity grow.
 *
 * The bug these tests guard against: the cart handover (guest cart +
 * account cart) was repeated on every pull, so the quantity doubled every
 * time (35 → 70 → 140 …) and could end up far above the stock.
 */
describe('Cart stock integrity', () => {
  describe('the account cart pull (live mode)', () => {
    const originalMock = environment.useMockApi;

    beforeEach(() => {
      localStorage.clear();
      environment.useMockApi = false;
    });

    afterEach(() => {
      environment.useMockApi = originalMock;
    });

    it('combines the guest cart with the account cart once, then adopts the server cart', () => {
      const serverCart = { lines: [{ productId: 'p1', qty: 46 }] };
      const fakeApi = {
        get: (path: string) => of(path === 'cart' ? serverCart : { productIds: [] }),
        put: () => of(null),
      };

      TestBed.configureTestingModule({
        providers: [
          ...hermeticApi(),
          { provide: ApiClientService, useValue: fakeApi },
          {
            provide: AuthService,
            useValue: { user: () => ({ id: 'u1' }), isLoggedIn: () => true },
          },
        ],
      });

      const cart = TestBed.inject(CartStore);

      // The customer has 46 in the cart; the account cart holds 46 too.
      cart.add('p1', 46);
      const sync = TestBed.inject(AccountSyncService);

      // The session-start pull: the guest cart and the account cart are
      // combined once.
      TestBed.flushEffects();
      expect(cart.qtyOf('p1')).toBe(92);

      // Every later pull adopts the server cart. The quantity must NOT
      // grow any more.
      sync.pull();
      expect(cart.qtyOf('p1')).toBe(46);
      sync.pull();
      expect(cart.qtyOf('p1')).toBe(46);
      sync.pull();
      expect(cart.qtyOf('p1')).toBe(46);
    });
  });

  describe('the cart view', () => {
    let view: CartViewService;
    let cart: CartStore;
    let byIdsImpl: () => ReturnType<ProductService['getByIdsMany']>;

    beforeEach(() => {
      localStorage.clear();
      byIdsImpl = () => of(MOCK_PRODUCTS);
      TestBed.configureTestingModule({
        providers: [...hermeticApi(), { provide: ProductService, useValue: { getByIdsMany: () => byIdsImpl() } }],
      });
      cart = TestBed.inject(CartStore);
      view = TestBed.inject(CartViewService);
    });

    it('reduces a quantity that is bigger than the live stock', () => {
      const product = { ...MOCK_PRODUCTS[0], stock: 46 };
      byIdsImpl = () => of([product]);

      // A stale cart (an old session, an offline device) holds 140.
      cart.add(product.id, 140, undefined, undefined, 9999);
      TestBed.flushEffects();

      expect(cart.qtyOf(product.id)).toBe(46);

      const line = view.lines().find((l) => l.productId === product.id)!;
      expect(line.qty).toBe(46);
      expect(line.qtyAdjusted).toBeTrue();
      expect(line.previousQty).toBe(140);
      expect(line.unavailable).toBeFalse();
    });

    it('marks a line as unavailable when the product is out of stock', () => {
      const product = { ...MOCK_PRODUCTS[0], stock: 0 };
      byIdsImpl = () => of([product]);

      cart.add(product.id, 1);
      TestBed.flushEffects();

      const line = view.lines().find((l) => l.productId === product.id)!;
      expect(line.unavailable).toBeTrue();
      // An out-of-stock line never contributes money.
      expect(view.pricedSubtotal()).toBe(0);
    });

    it('keeps the badge and the visible quantities in agreement', () => {
      const product = { ...MOCK_PRODUCTS[0], stock: 46 };
      byIdsImpl = () => of([product]);

      cart.add(product.id, 140, undefined, undefined, 9999);
      TestBed.flushEffects();

      const lines = view.lines();
      expect(cart.count()).toBe(lines.reduce((n, l) => n + l.qty, 0));
      expect(cart.count()).toBe(46);
    });
  });
});
