import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { of } from 'rxjs';
import { CartPageComponent } from './cart-page.component';
import { ProductService } from '../../core/services/product.service';
import { CartStore } from '../../core/services/cart.store';
import { I18nService } from '../../core/services/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { MOCK_PRODUCTS } from '../../data-access/mock-data';
import { hermeticApi } from '../../../testing/hermetic-api';

// Regression: the summary heading once asked a nonexistent `checkout.totals`
// key and rendered the raw key on /cart. Every customer-facing label asserted
// here must render translated text — never `section.key`.
describe('CartPageComponent (translated summary)', () => {
  let fixture: ComponentFixture<unknown>;
  let cart: CartStore;
  let i18n: I18nService;

  const text = (sel: string): string =>
    (fixture.nativeElement.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      providers: [
        ...hermeticApi(),
        provideRouter([]),
        provideNoopAnimations(),
        ConfirmationService,
        { provide: ProductService, useValue: { all: () => of(MOCK_PRODUCTS) } },
        { provide: NotificationService, useValue: { success: () => undefined, error: () => undefined, info: () => undefined } },
      ],
    }).compileComponents();
    cart = TestBed.inject(CartStore);
    i18n = TestBed.inject(I18nService);
    i18n.setLang('en');
    cart.add(MOCK_PRODUCTS[0].id, 2);
    cart.add('retired-product-id', 1);
    fixture = TestBed.createComponent(CartPageComponent);
    fixture.detectChanges();
  });

  it('renders the translated Totals heading, not the raw key', () => {
    expect(text('.summary h2')).toBe('Totals');
    expect(text('.summary h2')).not.toContain('checkout.totals');
  });

  it('renders translated subtotal, delivery and total rows', () => {
    const summary = text('.summary');
    for (const key of ['cart.subtotal', 'cart.delivery', 'cart.total']) {
      expect(summary).not.toContain(key);
    }
    expect(summary).toContain('Subtotal');
    expect(summary).toContain('Delivery');
    expect(summary).toContain('Total');
  });

  it('keeps unavailable rows visible with a translated label', () => {
    expect(fixture.nativeElement.querySelector('.unavailable-row')).toBeTruthy();
    expect(text('.lines')).toContain('No longer available');
    expect(text('.lines')).not.toContain('cart.unavailable');
  });

  it('renders the Arabic summary correctly in RTL', () => {
    i18n.setLang('ar');
    fixture.detectChanges();
    expect(text('.summary h2')).toBe('الإجماليات');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(text('.summary')).not.toContain('checkout.totals');
  });
});
