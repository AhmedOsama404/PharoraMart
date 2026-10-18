import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { FavoritesPageComponent } from './favorites-page.component';
import { ProductService } from '../../core/services/product.service';
import { CartStore } from '../../core/services/cart.store';
import { FavoritesStore } from '../../core/services/favorites.store';
import { NotificationService } from '../../core/services/notification.service';
import { MOCK_PRODUCTS } from '../../data-access/mock-data';
import { hermeticApi } from '../../../testing/hermetic-api';

const P = MOCK_PRODUCTS[0];

// Both favorites entry points (card button + "move to cart" button) must run
// the same single central mutation: one click → one line affected, repeated
// clicks accumulate on that line instead of duplicating it.
describe('FavoritesPageComponent (single-mutation entry points)', () => {
  let harness: RouterTestingHarness;
  let cart: CartStore;
  let favorites: FavoritesStore;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        ...hermeticApi(),
        provideRouter([{ path: 'favorites', component: FavoritesPageComponent }]),
        {
          provide: ProductService,
          useValue: {
            all: () => of(MOCK_PRODUCTS),
            list: () => of({ items: MOCK_PRODUCTS, total: MOCK_PRODUCTS.length }),
          },
        },
        { provide: NotificationService, useValue: { success: () => undefined, error: () => undefined, info: () => undefined } },
      ],
    });
    cart = TestBed.inject(CartStore);
    favorites = TestBed.inject(FavoritesStore);
    favorites.add(P.id);
    harness = await RouterTestingHarness.create();
  });

  function fixture(): ComponentFixture<unknown> {
    return harness.fixture;
  }

  it('card button click affects exactly one line with qty 1', async () => {
    await harness.navigateByUrl('/favorites', FavoritesPageComponent);
    fixture().detectChanges();
    // Drive through the card's output binding (native p-button clicks are
    // covered by real-browser probes; Karma cannot deliver them reliably).
    fixture().debugElement.query(By.css('app-product-card')).triggerEventHandler('add', P);
    fixture().detectChanges();
    expect(cart.lines().length).toBe(1);
    expect(cart.lines()[0].qty).toBe(1);
    expect(cart.lines()[0].productId).toBe(P.id);
  });

  it('repeated adds merge into the same line (no duplicate lines)', async () => {
    await harness.navigateByUrl('/favorites', FavoritesPageComponent);
    fixture().detectChanges();
    const card = fixture().debugElement.query(By.css('app-product-card'));
    card.triggerEventHandler('add', P);
    card.triggerEventHandler('add', P);
    fixture().detectChanges();
    expect(cart.lines().length).toBe(1);
    expect(cart.lines()[0].qty).toBe(2);
  });

  it('variant lines stay separate from the base line', () => {
    cart.add(P.id, 1);
    cart.add(P.id, 1, '250 g', '250 g');
    expect(cart.lines().length).toBe(2);
    expect(cart.count()).toBe(2);
  });

  it('different products never merge', () => {
    cart.add(MOCK_PRODUCTS[0].id, 1);
    cart.add(MOCK_PRODUCTS[1].id, 1);
    expect(cart.lines().length).toBe(2);
  });
});
