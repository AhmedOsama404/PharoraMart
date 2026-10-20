import { TestBed } from '@angular/core/testing';
import { of, throwError, Subject } from 'rxjs';
import { CartViewService } from './cart-view.service';
import { CartStore } from './cart.store';
import { ProductService } from './product.service';
import { MOCK_PRODUCTS } from '../../data-access/mock-data';
import { hermeticApi } from '../../../testing/hermetic-api';

describe('CartViewService (badge/page/checkout agreement)', () => {
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

  it('renders every stored line: stale ids become explicit unavailable rows', () => {
    cart.add('ghost-from-old-catalog', 2);
    cart.add(MOCK_PRODUCTS[0].id, 1);
    TestBed.flushEffects();
    const lines = view.lines();
    // Badge counts everything…
    expect(cart.count()).toBe(3);
    // …and the page shows everything: no silent drops.
    expect(lines.length).toBe(2);
    expect(lines.reduce((n, l) => n + l.qty, 0)).toBe(cart.count());
    const ghost = lines.find((l) => l.productId === 'ghost-from-old-catalog')!;
    expect(ghost.unavailable).toBeTrue();
    expect(ghost.product).toBeNull();
    expect(lines.find((l) => l.productId === MOCK_PRODUCTS[0].id)?.unavailable).toBeFalse();
  });

  it('excludes unavailable lines from money', () => {
    cart.add('ghost-from-old-catalog', 5);
    cart.add(MOCK_PRODUCTS[0].id, 2);
    TestBed.flushEffects();
    const valid = MOCK_PRODUCTS[0];
    const unit = valid.salePrice ?? valid.price;
    expect(view.pricedSubtotal()).toBe(2 * unit);
    expect(view.unavailableCount()).toBe(1);
  });

  it('distinguishes loading, ready and error states', () => {
    const gate = new Subject<typeof MOCK_PRODUCTS>();
    byIdsImpl = () => gate;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [...hermeticApi(), { provide: ProductService, useValue: { getByIdsMany: () => byIdsImpl() } }],
    });
    localStorage.clear();
    cart = TestBed.inject(CartStore);
    const v2 = TestBed.inject(CartViewService);
    cart.add('p1', 1);
    TestBed.flushEffects();
    expect(v2.ready()).toBeFalse();
    gate.next(MOCK_PRODUCTS);
    expect(v2.ready()).toBeTrue();
    expect(v2.failed()).toBeFalse();
  });

  it('recovers from catalog failure via refresh', () => {
    byIdsImpl = () => throwError(() => new Error('down'));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [...hermeticApi(), { provide: ProductService, useValue: { getByIdsMany: () => byIdsImpl() } }],
    });
    localStorage.clear();
    cart = TestBed.inject(CartStore);
    cart.add('p1', 1);
    const v2 = TestBed.inject(CartViewService);
    TestBed.flushEffects();
    expect(v2.failed()).toBeTrue();
    byIdsImpl = () => of(MOCK_PRODUCTS);
    v2.refresh();
    expect(v2.failed()).toBeFalse();
    expect(v2.ready()).toBeTrue();
  });
});
