import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AccountSyncService } from './account-sync.service';
import { AuthService } from './auth.service';
import { CartStore } from './cart.store';
import { FavoritesStore } from './favorites.store';
import { ContentService } from './content.service';

describe('AccountSyncService (mock mode)', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('is a no-op pull in mock mode and never crashes without a session', () => {
    const sync = TestBed.inject(AccountSyncService);
    expect(() => sync.pull()).not.toThrow();
    expect(TestBed.inject(CartStore).lines()).toEqual([]);
  });

  it('logout clears account-scoped cart, favorites and order storage', (done) => {
    const auth = TestBed.inject(AuthService);
    const cart = TestBed.inject(CartStore);
    const favs = TestBed.inject(FavoritesStore);
    auth.register({ name: 'T', email: 'sync@t.t', password: 'secret12' }).subscribe(() => {
      cart.add('p1', 2);
      favs.add('p1');
      localStorage.setItem('novamart.orders.v1', '[]');
      auth.logout();
      expect(auth.isLoggedIn()).toBeFalse();
      expect(cart.lines()).toEqual([]);
      expect(favs.ids()).toEqual([]);
      expect(localStorage.getItem('novamart.orders.v1')).toBeNull();
      done();
    });
  });

  it('stores replace server state defensively', () => {
    const cart = TestBed.inject(CartStore);
    cart.replaceAll([
      { productId: 'p1', qty: 2 },
      { productId: '', qty: 3 },
      { productId: 'p2', qty: NaN },
    ]);
    expect(cart.lines().map((l) => l.productId)).toEqual(['p1']);
    const favs = TestBed.inject(FavoritesStore);
    favs.replaceAll(['a', 42 as unknown as string, 'a']);
    expect(favs.ids()).toEqual(['a']);
  });

  it('content service returns empty list in mock mode', (done) => {
    TestBed.inject(ContentService)
      .published()
      .subscribe((blocks) => {
        expect(blocks).toEqual([]);
        done();
      });
  });
});
