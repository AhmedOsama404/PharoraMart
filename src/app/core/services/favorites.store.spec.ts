import { TestBed } from '@angular/core/testing';
import { FavoritesStore } from './favorites.store';

describe('FavoritesStore', () => {
  let store: FavoritesStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(FavoritesStore);
  });

  it('adds favorites idempotently (no duplicates)', () => {
    store.add('p1');
    store.add('p1');
    expect(store.ids()).toEqual(['p1']);
    expect(store.count()).toBe(1);
  });

  it('toggles correctly', () => {
    expect(store.toggle('p1')).toBeTrue();
    expect(store.has('p1')).toBeTrue();
    expect(store.toggle('p1')).toBeFalse();
    expect(store.has('p1')).toBeFalse();
  });

  it('removes gracefully when missing', () => {
    expect(() => store.remove('nope')).not.toThrow();
    expect(store.count()).toBe(0);
  });

  it('persists guest favorites to localStorage', () => {
    store.add('p1');
    store.add('p2');
    const restored = new FavoritesStore();
    expect(restored.ids()).toEqual(['p1', 'p2']);
  });
});
