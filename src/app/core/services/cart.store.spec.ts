import { TestBed } from '@angular/core/testing';
import { CartStore } from './cart.store';

describe('CartStore', () => {
  let store: CartStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(CartStore);
  });

  it('starts empty', () => {
    expect(store.isEmpty()).toBeTrue();
    expect(store.count()).toBe(0);
  });

  it('adds a new line and merges duplicates (same product + variant)', () => {
    store.add('p1', 2);
    store.add('p1', 3);
    expect(store.lines().length).toBe(1);
    expect(store.lines()[0].qty).toBe(5);
    expect(store.count()).toBe(5);
  });

  it('keeps variants as separate lines', () => {
    store.add('p1', 1, 'Red', 'Red');
    store.add('p1', 1, 'Blue', 'Blue');
    expect(store.lines().length).toBe(2);
  });

  it('clamps quantity to stock and minimum 1', () => {
    store.add('p1', 50, undefined, undefined, 5);
    expect(store.lines()[0].qty).toBe(5);
    store.setQty(store.lines()[0].key, 99, 5);
    expect(store.lines()[0].qty).toBe(5);
    store.setQty(store.lines()[0].key, 0, 5);
    expect(store.lines()[0].qty).toBe(1);
  });

  it('updates and removes quantities', () => {
    store.add('p1', 2);
    const key = store.lines()[0].key;
    store.setQty(key, 4);
    expect(store.lines()[0].qty).toBe(4);
    store.remove(key);
    expect(store.isEmpty()).toBeTrue();
  });

  it('clears the cart', () => {
    store.add('p1', 1);
    store.add('p2', 1);
    store.clear();
    expect(store.isEmpty()).toBeTrue();
  });

  it('merges guest and server cart lines, summing matching product variants', () => {
    store.add('p1', 2, 'M', 'Size M');
    store.add('guest-only', 1);
    const merged = store.mergedWith([
      { productId: 'p1', variantKey: 'M', variantLabel: 'Size M', qty: 3 },
      { productId: 'server-only', qty: 4 },
    ]);
    store.replaceAll(
      merged.map((l) => ({ productId: l.productId, variantKey: l.variantKey, variantLabel: l.variantLabel, qty: l.qty })),
    );

    expect(store.lines().map(({ productId, qty }) => [productId, qty])).toEqual([
      ['p1', 5],
      ['guest-only', 1],
      ['server-only', 4],
    ]);
  });

  it('persists guest cart to localStorage and restores it', () => {
    store.add('p1', 2, 'M', 'Size M');
    const raw = localStorage.getItem('novamart.cart.v1');
    expect(raw).toContain('p1');
    const restored = new CartStore();
    expect(restored.lines().length).toBe(1);
    expect(restored.lines()[0].qty).toBe(2);
    expect(restored.lines()[0].variantKey).toBe('M');
  });
});
