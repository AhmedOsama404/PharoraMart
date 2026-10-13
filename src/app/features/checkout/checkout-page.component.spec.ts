import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Signal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CheckoutPageComponent } from './checkout-page.component';
import { ProductService } from '../../core/services/product.service';
import { DeliveryService } from '../../core/services/delivery.service';
import { CartStore } from '../../core/services/cart.store';
import { AuthService } from '../../core/services/auth.service';
import { OrderService } from '../../core/services/order.service';
import { NotificationService } from '../../core/services/notification.service';
import { MOCK_PRODUCTS } from '../../data-access/mock-data';

describe('CheckoutPageComponent (hotel delivery)', () => {
  let fixture: ComponentFixture<CheckoutPageComponent>;
  let comp: CheckoutPageComponent;
  let orders: OrderService;
  let cart: CartStore;

  // Test-only view over protected members (the template is the real caller).
  type Exposed = {
    form: FormGroup;
    onHotelChange(v: unknown): void;
    submit(): void;
    quoteFailed: Signal<boolean>;
  };
  const x = (c: CheckoutPageComponent): Exposed => c as unknown as Exposed;

  const stubProducts = {
    all: () => of(MOCK_PRODUCTS),
    list: () => of({ items: MOCK_PRODUCTS, total: MOCK_PRODUCTS.length }),
  };
  const stubDelivery = {
    hotels: () =>
      of([
        { id: 'h1', name: 'Hotel One', city: 'Marsa Alam', isActive: true, sortOrder: 1, zoneId: 'z1', deliveryFee: 6 },
        { id: 'h2', name: 'Hotel Two', city: 'Hurghada', isActive: true, sortOrder: 1, zoneId: 'z2', deliveryFee: 12 },
      ]),
    cities: () => of(['Marsa Alam', 'Hurghada']),
    hotelById: (id: string) =>
      id === 'h1'
        ? { id: 'h1', name: 'Hotel One', city: 'Marsa Alam', isActive: true, sortOrder: 1, zoneId: 'z1', deliveryFee: 6 }
        : undefined,
    quoteFor: (id: string) =>
      id === 'h1' ? of({ hotelId: id, fee: 6, currency: 'USD', source: 'sample' as const }) : throwError(() => new Error('unknown-hotel')),
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ProductService, useValue: stubProducts },
        { provide: DeliveryService, useValue: stubDelivery },
        { provide: NotificationService, useValue: { success: () => undefined, error: () => undefined, info: () => undefined } },
      ],
    });
    orders = TestBed.inject(OrderService);
    cart = TestBed.inject(CartStore);
    TestBed.inject(AuthService);
    fixture = TestBed.createComponent(CheckoutPageComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  function fillContact(): void {
    x(comp).form.patchValue({ fullName: 'Hotel Guest', phone: '+201001234567', city: 'Marsa Alam' });
  }

  it('shows the quoted hotel fee in the totals', () => {
    cart.add(MOCK_PRODUCTS[0].id, 1, undefined, undefined, 99);
    fillContact();
    x(comp).onHotelChange('h1');
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('6');
  });

  it('blocks submit without a hotel (form invalid, no order created)', () => {
    cart.add(MOCK_PRODUCTS[0].id, 1, undefined, undefined, 99);
    fillContact();
    let created = 0;
    spyOn(orders, 'create').and.callFake(() => {
      created++;
      return throwError(() => new Error('nope'));
    });
    x(comp).submit();
    expect(created).toBe(0);
    expect(x(comp).form.get('hotelId')?.invalid).toBeTrue();
  });

  it('blocks submit when the quote fails instead of charging a guessed fee', () => {
    cart.add(MOCK_PRODUCTS[0].id, 1, undefined, undefined, 99);
    fillContact();
    x(comp).form.get('hotelId')?.setValue('gone');
    x(comp).onHotelChange('gone');
    fixture.detectChanges();
    let created = 0;
    spyOn(orders, 'create').and.callFake(() => {
      created++;
      return throwError(() => new Error('nope'));
    });
    x(comp).submit();
    expect(created).toBe(0);
    expect(x(comp).quoteFailed()).toBeTrue();
  });

  it('submits with the hotel snapshot once quoted', (done) => {
    cart.add(MOCK_PRODUCTS[0].id, 1, undefined, undefined, 99);
    fillContact();
    x(comp).form.get('hotelId')?.setValue('h1');
    x(comp).onHotelChange('h1');
    fixture.detectChanges();
    x(comp).submit();
    orders.list().subscribe((list) => {
      expect(list.length).toBe(1);
      expect(list[0].customer.hotelName).toBe('Hotel One');
      expect(list[0].deliveryFee).toBe(6);
      done();
    });
  });
});
