import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, HttpErrorResponse } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Signal, WritableSignal } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError, type Observable } from 'rxjs';
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
import type { CreateOrderRequest } from '../../models/order.model';

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
    couponError: Signal<string>;
    submitError: WritableSignal<string>;
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
  // The directory is swappable so one test can make the first load fail.
  let hotelDirectory: () => Observable<unknown[]> = () =>
    of([
      { id: 'h1', name: 'Hotel One', city: 'Marsa Alam', isActive: true, sortOrder: 1, zoneId: 'z1', deliveryFee: 6 },
      { id: 'h2', name: 'Hotel Two', city: 'Hurghada', isActive: true, sortOrder: 1, zoneId: 'z2', deliveryFee: 12 },
    ]);
  const stubDelivery = {
    hotels: () => hotelDirectory(),
    reloadHotels: () => hotelDirectory(),
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

  afterEach(() => {
    environment.useMockApi = originalUseMockApi;
    // A test may have swapped the directory for a failing one.
    hotelDirectory = () =>
      of([
        { id: 'h1', name: 'Hotel One', city: 'Marsa Alam', isActive: true, sortOrder: 1, zoneId: 'z1', deliveryFee: 6 },
        { id: 'h2', name: 'Hotel Two', city: 'Hurghada', isActive: true, sortOrder: 1, zoneId: 'z2', deliveryFee: 12 },
      ]);
  });

  function fillContact(): void {
    // The email is the way the order status is sent, so it is required.
    x(comp).form.patchValue({
      fullName: 'Hotel Guest',
      phone: '+201001234567',
      city: 'Marsa Alam',
      email: 'guest@example.com',
    });
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

  it('states the total once and never prints the support address', async () => {
    cart.add(MOCK_PRODUCTS[0].id, 1, undefined, undefined, 99);
    fillContact();
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const summary = el.querySelector('.summary') as HTMLElement;
    // The amount lives in the pinned action area only: one Total, no second
    // "Total" row in the breakdown above it.
    expect((summary.textContent?.match(/Total/g) ?? []).length).toBe(1);
    expect(el.querySelector('.grand')).toBeNull();
    // The contact card says what will be sent; the store's support address
    // belongs to the footer, not here.
    const contactCard = el.querySelectorAll('p-card')[0] as HTMLElement;
    expect(contactCard.textContent).not.toContain('@');
    expect(el.querySelector('.update-note')?.textContent).toContain('order status');
  });

  it('always sends email as the contact method and never opts into WhatsApp', async () => {
    cart.add(MOCK_PRODUCTS[0].id, 1, undefined, undefined, 99);
    fillContact();
    x(comp).form.get('hotelId')?.setValue('h1');
    x(comp).onHotelChange('h1');
    fixture.detectChanges();

    const create = spyOn(orders, 'create').and.callThrough();
    await x(comp).submit();

    const req = create.calls.mostRecent().args[0] as CreateOrderRequest;
    expect(req.customer.contactMethod).toBe('email');
    // Order updates go out by email only, so there is no WhatsApp opt-in and
    // no consent proof travels with the order.
    expect(req.whatsappOptIn).toBeFalse();
    expect(req.consentTextHash).toBeUndefined();
  });

  it('sends an empty image for a product without a picture, never undefined', async () => {
    // The API's order item `image` is a required string: `undefined` is a 400.
    const withoutImage = { ...MOCK_PRODUCTS[0], images: [] as string[], currency: 'USD' };
    spyOn(stubProducts, 'getByIdsMany').and.returnValue(of([withoutImage]));
    cart.add(withoutImage.id, 1, undefined, undefined, 99);
    fillContact();
    x(comp).form.get('hotelId')?.setValue('h1');
    x(comp).onHotelChange('h1');
    fixture.detectChanges();

    const create = spyOn(orders, 'create').and.callThrough();
    await x(comp).submit();

    const req = create.calls.mostRecent().args[0] as CreateOrderRequest;
    expect(req.items.length).toBeGreaterThan(0);
    for (const item of req.items) {
      expect(typeof item.image).toBe('string');
    }
  });

  it('retries the hotel directory after a failed load', () => {
    // The form (and with it the directory error) only renders with a cart.
    cart.add(MOCK_PRODUCTS[0].id, 1, undefined, undefined, 99);
    hotelDirectory = () => throwError(() => new Error('offline'));
    const failFixture = TestBed.createComponent(CheckoutPageComponent);
    failFixture.detectChanges();

    const view = failFixture.componentInstance as unknown as {
      directoryFailed: Signal<boolean>;
      retryDirectory(): void;
    };
    expect(view.directoryFailed()).toBeTrue();
    // The error is shown with a way out — not a dead end.
    expect(failFixture.nativeElement.textContent as string).toContain('could not be loaded');

    // The retry re-reads the directory and clears the error.
    hotelDirectory = () => of([{ id: 'h1', name: 'Hotel One', city: 'Marsa Alam', isActive: true, sortOrder: 1, zoneId: 'z1', deliveryFee: 6 }]);
    view.retryDirectory();
    failFixture.detectChanges();
    expect(view.directoryFailed()).toBeFalse();
  });

  it('keeps the apply label on the action and shows the applied code', () => {
    cart.add(MOCK_PRODUCTS[0].id, 1, undefined, undefined, 99);
    environment.useMockApi = false;
    const api = TestBed.inject(ApiClientService);
    spyOn(api, 'post').and.returnValue(of({ valid: true, code: 'TDBYY20HFY', discount: 3 }));
    x(comp).couponControl.setValue('tdbyy20hfy');
    x(comp).applyCoupon();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.coupon-row button') as HTMLButtonElement;
    expect(x(comp).couponApplied()).toBe('TDBYY20HFY');
    // The button still applies a code, so its label says what it does.
    expect(button.textContent?.trim()).toBe('Apply promo code');
    // The applied code is shown next to it, with a way to take it off.
    const applied = fixture.nativeElement.querySelector('.coupon-applied') as HTMLElement;
    expect(applied.textContent).toContain('TDBYY20HFY');
  });

  it('applies the promo code on Enter and never places the order', () => {
    cart.add(MOCK_PRODUCTS[0].id, 1, undefined, undefined, 99);
    environment.useMockApi = false;
    fixture.detectChanges();
    const api = TestBed.inject(ApiClientService);
    const post = spyOn(api, 'post').and.returnValue(of({ valid: true, code: 'SAVE10', discount: 3 }));
    const create = spyOn(orders, 'create').and.callThrough();
    x(comp).couponControl.setValue('save10');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.coupon-row input') as HTMLInputElement;
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(enter);
    fixture.detectChanges();

    // Enter applies the code...
    expect(post).toHaveBeenCalled();
    expect(x(comp).couponApplied()).toBe('SAVE10');
    // ...and never submits the form, which would place the order.
    expect(enter.defaultPrevented).toBeTrue();
    expect(create).not.toHaveBeenCalled();
  });

  it('sends the basket with the coupon validation, so the server can apply the scope rule', () => {
    cart.add(MOCK_PRODUCTS[0].id, 2, undefined, undefined, 99);
    environment.useMockApi = false;
    fixture.detectChanges();
    const api = TestBed.inject(ApiClientService);
    const post = spyOn(api, 'post').and.returnValue(of({ valid: true, discount: 3 }));

    x(comp).couponControl.setValue('save10');
    x(comp).applyCoupon();

    // A product-scoped coupon depends on WHAT is in the basket. Without the
    // basket the server cannot apply the same rule order placement applies,
    // and the coupon would be "valid" here but rejected at submit.
    expect(post).toHaveBeenCalled();
    const body = post.calls.mostRecent().args[1] as { productIds: string[] };
    expect(body.productIds).toContain(MOCK_PRODUCTS[0].id);
  });

  it('says what is missing when the promo code is empty', () => {    cart.add(MOCK_PRODUCTS[0].id, 1, undefined, undefined, 99);
    fixture.detectChanges();
    x(comp).applyCoupon();
    fixture.detectChanges();
    expect(x(comp).couponError()).toBe('Enter a coupon code first.');
  });

  it('clears the error of the last attempt when the customer edits the form', () => {
    cart.add(MOCK_PRODUCTS[0].id, 1, undefined, undefined, 99);
    x(comp).submitError.set('Something went wrong.');
    x(comp).form.get('fullName')?.setValue('Another Guest');
    expect(x(comp).submitError()).toBe('');
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
