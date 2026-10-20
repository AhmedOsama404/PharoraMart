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
 * A tiny stand-in for the server cart: PUT replaces it (clamped to the
 * stock, exactly like the real API), GET returns it.
 */
function fakeServer(stock = 8) {
  const state = { lines: [] as { productId: string; qty: number }[] };

  const api = {
    get: (path: string) =>
      of(
        (path === 'cart'
          ? { lines: state.lines.map((l) => ({ ...l })) }
          : { productIds: [] }) as never,
      ),
    put: (path: string, body: { lines?: { productId: string; qty: number }[] }) => {
      if (path === 'cart' && body?.lines) {
        state.lines = body.lines.map((l) => ({
          productId: l.productId,
          qty: Math.max(1, Math.min(stock, Math.floor(l.qty))),
        }));
      }
      return of(null);
    },
  };

  return { api, state };
}

describe('the cart quantity never doubles', () => {
  const originalMock = environment.useMockApi;

  beforeEach(() => {
    localStorage.clear();
    environment.useMockApi = false;
  });

  afterEach(() => {
    environment.useMockApi = originalMock;
  });

  it('keeps the same quantity after a reload', () => {
    const { api, state } = fakeServer(8);

    TestBed.configureTestingModule({
      providers: [
        ...hermeticApi(),
        { provide: ApiClientService, useValue: api },
        {
          provide: AuthService,
          useValue: { user: () => ({ id: 'u1' }), isLoggedIn: () => true },
        },
      ],
    });

    const cart = TestBed.inject(CartStore);
    const sync = TestBed.inject(AccountSyncService);

    // The customer has 2 in the guest cart; the account cart has 3.
    cart.add('p1', 2);
    state.lines = [{ productId: 'p1', qty: 3 }];

    // The first pull: the guest cart and the account cart are combined ONCE
    // (2 + 3) and the server's answer is adopted.
    sync.pull();
    expect(cart.qtyOf('p1')).toBe(5);

    // A RELOAD: the page is opened again. The local cart is restored from
    // local storage and the service is new, but the cart has already been
    // handed over, so the server is the source of truth. The quantity must
    // NOT move.
    const reloaded = TestBed.inject(CartStore);
    reloaded.add('p1', 5);
    const syncAgain = TestBed.inject(AccountSyncService);
    syncAgain.pull();

    expect(reloaded.qtyOf('p1')).toBe(5);
    expect(state.lines[0]?.qty).toBe(5);

    // And again, for good measure.
    syncAgain.pull();
    expect(reloaded.qtyOf('p1')).toBe(5);
  });

  it('never holds more than the cap of ten', () => {
    const { api } = fakeServer(999);

    TestBed.configureTestingModule({
      providers: [
        ...hermeticApi(),
        { provide: ApiClientService, useValue: api },
        {
          provide: AuthService,
          useValue: { user: () => ({ id: 'u2' }), isLoggedIn: () => true },
        },
      ],
    });

    const cart = TestBed.inject(CartStore);

    // Even with a thousand in stock, ten is the most one line may hold.
    cart.add('p1', 500, undefined, undefined, 999);
    expect(cart.qtyOf('p1')).toBe(10);

    cart.setQty(cart.lines()[0].key, 250, 999);
    expect(cart.qtyOf('p1')).toBe(10);

    cart.setQty(cart.lines()[0].key, 4, 999);
    expect(cart.qtyOf('p1')).toBe(4);
  });
});

describe('Cart stock integrity', () => {
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
      const product = { ...MOCK_PRODUCTS[0], stock: 8 };
      byIdsImpl = () => of([product]);

      // A stale cart (an old session, an offline device) holds 6.
      cart.add(product.id, 6, undefined, undefined, 999);
      TestBed.flushEffects();

      expect(cart.qtyOf(product.id)).toBe(6);

      const line = view.lines().find((l) => l.productId === product.id)!;
      expect(line.qty).toBe(6);
      expect(line.qtyAdjusted).toBeFalse();
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
      const product = { ...MOCK_PRODUCTS[0], stock: 8 };
      byIdsImpl = () => of([product]);

      cart.add(product.id, 6, undefined, undefined, 999);
      TestBed.flushEffects();

      const lines = view.lines();
      expect(cart.count()).toBe(lines.reduce((n, l) => n + l.qty, 0));
      expect(cart.count()).toBe(6);
    });
  });
});
