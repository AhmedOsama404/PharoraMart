import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, HttpErrorResponse } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Signal } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { CheckoutPageComponent } from './checkout-page.component';
import { ProductService } from '../../core/services/product.service';
import { DeliveryService } from '../../core/services/delivery.service';
import { CartStore } from '../../core/services/cart.store';
import { CartViewService } from '../../core/services/cart-view.service';
import { AuthService } from '../../core/services/auth.service';
import { OrderService } from '../../core/services/order.service';
import { NotificationService } from '../../core/services/notification.service';
import { MOCK_PRODUCTS } from '../../data-access/mock-data';
import { testRatesProvider } from '../../../testing/hermetic-api';
import { ApiClientService } from '../../core/api/api-client.service';
import { CurrencyService } from '../../core/services/currency.service';
import { environment } from '../../../environments/environment';

describe('CheckoutPageComponent (hotel delivery)', () => {
  let fixture: ComponentFixture<CheckoutPageComponent>;
  let comp: CheckoutPageComponent;
  let orders: OrderService;
  let cart: CartStore;
  let originalUseMockApi: boolean;

  // Test-only view over protected members (the template is the real caller).
  type Exposed = {
    form: FormGroup;
    couponControl: FormControl<string>;
    couponApplied: Signal<string>;
    subtotal: Signal<number>;
    applyCoupon(): void;
    onHotelChange(v: unknown): void;
    submit(): Promise<void>;
    quoteFailed: Signal<boolean>;
  };
  const x = (c: CheckoutPageComponent): Exposed => c as unknown as Exposed;

  const stubProducts = {
    all: () => of(MOCK_PRODUCTS.map((product) => ({ ...product, currency: product.currency ?? 'USD' }))),
    getByIdsMany: () => of(MOCK_PRODUCTS.map((product) => ({ ...product, currency: product.currency ?? 'USD' }))),
    list: () => of({ items: MOCK_PRODUCTS.map((product) => ({ ...product, currency: product.currency ?? 'USD' })), total: MOCK_PRODUCTS.length }),
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
    originalUseMockApi = environment.useMockApi;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        testRatesProvider,
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

  afterEach(() => { environment.useMockApi = originalUseMockApi; });

  function fillContact(): void {
    x(comp).form.patchValue({ fullName: 'Hotel Guest', phone: '+201001234567', city: 'Marsa Alam' });
  }

  it('shows the quoted hotel fee in the totals', async () => {
    cart.add(MOCK_PRODUCTS[0].id, 1, undefined, undefined, 99);
    fillContact();
    x(comp).onHotelChange('h1');
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('6');
  });

  it('shows a stable promo-code label after applying the entered code', () => {
    cart.add(MOCK_PRODUCTS[0].id, 1, undefined, undefined, 99);
    environment.useMockApi = false;
    const api = TestBed.inject(ApiClientService);
    spyOn(api, 'post').and.returnValue(of({ valid: true, code: 'TDBYY20HFY', discount: 3 }));
    x(comp).couponControl.setValue('tdbyy20hfy');
    x(comp).applyCoupon();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.coupon-row button') as HTMLButtonElement;
    expect(x(comp).couponApplied()).toBe('TDBYY20HFY');
    expect(button.textContent?.trim()).toBe('Promo code applied');
  });

  it('revalidates the coupon with the recalculated subtotal after currency changes', () => {
    cart.add(MOCK_PRODUCTS[0].id, 1, undefined, undefined, 99);
    environment.useMockApi = false;
    fixture.detectChanges();
    const api = TestBed.inject(ApiClientService);
    const post = spyOn(api, 'post').and.returnValue(of({ valid: true, code: 'SAVE10', discount: 3 }));
    x(comp).couponControl.setValue('save10');
    x(comp).applyCoupon();
    const firstSubtotal = post.calls.mostRecent().args[1] as { subtotal: number };

    TestBed.inject(CurrencyService).setCurrency('EUR');
    fixture.detectChanges();

    expect(post).toHaveBeenCalledTimes(2);
    const nextSubtotal = post.calls.mostRecent().args[1] as { subtotal: number };
    expect(nextSubtotal.subtotal).toBe(x(comp).subtotal());
    expect(nextSubtotal.subtotal).not.toBe(firstSubtotal.subtotal);
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

  it('blocks submit when the quote fails instead of charging a guessed fee', async () => {
    cart.add(MOCK_PRODUCTS[0].id, 1, undefined, undefined, 99);
    fillContact();
    x(comp).form.get('hotelId')?.setValue('gone');
    x(comp).onHotelChange('gone');
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
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

  it('submits with the hotel snapshot once quoted', async () => {
    cart.add(MOCK_PRODUCTS[0].id, 1, undefined, undefined, 99);
    fillContact();
    x(comp).form.get('hotelId')?.setValue('h1');
    x(comp).onHotelChange('h1');
    fixture.detectChanges();
    await x(comp).submit();
    const list = await new Promise<import('../../models/order.model').Order[]>((resolve) => {
      orders.list().subscribe(resolve);
    });
    expect(list.length).toBe(1);
    expect(list[0].customer.hotelName).toBe('Hotel One');
    expect(list[0].deliveryFee).toBe(6);
  });

  it('refreshes live stock on an out-of-stock rejection (item 27)', async () => {
    cart.add(MOCK_PRODUCTS[0].id, 1, undefined, undefined, 99);
    fillContact();
    x(comp).form.get('hotelId')?.setValue('h1');
    x(comp).onHotelChange('h1');
    fixture.detectChanges();

    const view = TestBed.inject(CartViewService);
    const refresh = spyOn(view, 'refresh').and.callThrough();
    spyOn(orders, 'create').and.returnValue(
      throwError(
        () => new HttpErrorResponse({ status: 422, error: { code: 'order_out_of_stock' } }),
      ),
    );

    await x(comp).submit();

    // The visitor must see current quantities/prices after a stock conflict.
    expect(refresh).toHaveBeenCalled();
  });
});
