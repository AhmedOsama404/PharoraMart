import { SafeImageDirective } from '../../shared/resilience/safe-image.directive';
import { SUPPORTED_LANGS } from '../../core/config/i18n.config';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked, type OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Divider } from 'primeng/divider';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Textarea } from 'primeng/textarea';
import { I18nService } from '../../core/services/i18n.service';
import { CurrencyService } from '../../core/services/currency.service';
import { CartStore } from '../../core/services/cart.store';
import { CartViewService } from '../../core/services/cart-view.service';
import { AuthService } from '../../core/services/auth.service';
import { OrderService } from '../../core/services/order.service';
import { NotificationService } from '../../core/services/notification.service';
import { DeliveryService } from '../../core/services/delivery.service';
import { ScrollService } from '../../core/services/scroll.service';
import { ApiClientService } from '../../core/api/api-client.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { firstErrorKey, phoneValidator } from '../../shared/utils/validators';
import { PhoneInputComponent } from '../../shared/components/phone-input.component';
import { ConnectivityService } from '../../core/resilience/connectivity.service';
import type { CreateOrderRequest } from '../../models/order.model';
import type { Hotel } from '../../models/hotel.model';
import type { Product } from '../../models/product.model';
import { pickLocaleText } from '../../shared/utils/localized.utils';
import { environment } from '../../../environments/environment';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { PriceResolverService } from '../../core/services/price-resolver.service';
import { ExchangeRatesService } from '../../core/services/exchange-rates.service';
import { SiteContentService } from '../../core/services/site-content.service';
import type { SiteCheckoutContent } from '../../models/site-content.model';

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SafeImageDirective,
    ReactiveFormsModule, Button, Card, Divider, InputText, Message,
    Select, Textarea, Skeleton, EmptyStateComponent, MoneyPipe, PhoneInputComponent,
  ],
  templateUrl: './checkout-page.component.html',
  styleUrl: './checkout-page.component.scss',
})
export class CheckoutPageComponent implements OnInit {
  protected i18n = inject(I18nService);
  protected siteContent = inject(SiteContentService);
  private currency = inject(CurrencyService);
  private prices = inject(PriceResolverService);
  private rates = inject(ExchangeRatesService);
  private fb = inject(FormBuilder);
  protected cart = inject(CartStore);
  protected view = inject(CartViewService);
  private auth = inject(AuthService);
  private orders = inject(OrderService);
  private notify = inject(NotificationService);
  private delivery = inject(DeliveryService);
  private api = inject(ApiClientService);
  private apiError = inject(ApiErrorService);
  private router = inject(Router);
  private scroll = inject(ScrollService);
  private connectivity = inject(ConnectivityService);
  private readonly destroyRef = inject(DestroyRef);

  protected placing = signal(false);
  protected submitError = signal('');
  // One idempotency key per checkout attempt: double-clicks and retries reuse
  // it, so the order service can never create the order twice.
  private submittedKey: string | null = null;

  protected form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    phone: ['', [Validators.required, phoneValidator]],
    email: ['', [Validators.required, Validators.email]],
    city: ['', [Validators.required]],
    hotelId: ['', [Validators.required]],
    room: [''],
    notes: [''],
    // The language the customer wants to be contacted in. It is required,
    // and it is frozen on the order: the messages always use it.
    language: ['', [Validators.required]],
    // How the customer wants to be contacted about this order. WhatsApp is
    // suspended for now, so the order status goes by email; the moment
    // WhatsApp is back, the choice comes back with it.
    contactMethod: ['email' as 'phone' | 'whatsapp' | 'email', [Validators.required]],
  });

  // Hotel directory (data-driven; the dashboard can extend it freely).
  protected cities = signal<string[]>([]);
  protected hotels = signal<Hotel[]>([]);
  /** True when the directory could not be loaded (the selects would be empty). */
  protected directoryFailed = signal(false);
  // Authoritative delivery fee for the chosen hotel. Null = no hotel chosen
  // yet; the quote service (mock today, backend tomorrow) is the only writer.
  protected quotedFee = signal<number | null>(null);
  /** True while a fee is being fetched: the total is not known yet. */
  protected quotePending = signal(false);
  protected quoteFailed = signal(false);
  // Coupon state (live mode only): the backend validates and prices the code;
  // the receipted discount below is informational until the order returns.
  protected couponControl = new FormControl('', { nonNullable: true });
  protected couponApplied = signal('');
  protected couponDiscount = signal(0);
  protected couponError = signal('');
  protected couponBusy = signal(false);
  private quoteSequence = 0;
  private couponValidationSequence = 0;
  private lastCouponValidationKey = '';

  // Hotel dropdown options for the selected city, with the sample fee shown
  // upfront. Memoized for stable p-select references.
  protected hotelOptions = computed(() => {
    const city = this.selectedCity();
    return this.hotels()
      .filter((h) => !city || h.city === city)
      .map((h) => ({
        label: `${h.name}${h.area ? ` — ${h.area}` : ''} · ${this.hotelFeeLabel(h)}`,
        value: h.id,
      }));
  });
  protected selectedCity = signal('');
  private selectedHotel = signal('');
  protected quoteRateDate = signal<string | null>(null);

  // City filter options derived from the hotel directory (new cities appear
  // automatically when the dashboard adds hotels there).
  protected cityOptions = computed(() => this.cities().map((c) => ({ label: c, value: c })));

  constructor() {
    // The directory is required to choose a hotel/city; if it cannot load the
    // form stays open (no crash) and submit is blocked by validation/quote.
    // Both calls read the same cached directory, so this is ONE request.
    this.delivery
      .hotels()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.hotels.set(list);
          this.directoryFailed.set(false);
        },
        error: () => {
          this.hotels.set([]);
          this.directoryFailed.set(true);
        },
      });
    this.delivery
      .cities()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => this.cities.set(list),
        error: () => this.cities.set([]),
      });
    effect(() => {
      const code = this.currency.code();
      const subtotal = this.subtotal();
      const hotelId = this.selectedHotel();
      if (hotelId) untracked(() => this.refreshQuote(hotelId));
      void code; void subtotal;
    });
    // A validated discount uses the currency and subtotal from its validation.
    // Revalidate when prices or the header currency change so the displayed
    // total stays in step with the order request.
    effect(() => {
      const code = this.couponApplied();
      if (!code) {
        this.lastCouponValidationKey = '';
        return;
      }
      const subtotal = this.subtotal();
      const currencyCode = this.currency.code();
      const key = this.couponValidationKey(code, subtotal, currencyCode);
      if (key !== this.lastCouponValidationKey) {
        untracked(() => this.validateCoupon(code, subtotal, currencyCode));
      }
    });
    // Pre-fill from the demo session when available; guests fill it manually.
    const u = this.auth.user();
    if (u) {
      this.form.patchValue({ fullName: u.name, email: u.email, phone: u.phone ?? '' });
    }
    // When the backend comes back, unblock the money flow without a reload.
    this.connectivity.recovered$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.view.failed()) this.view.refresh();
        const hotelId = this.selectedHotel();
        if (hotelId) this.refreshQuote(hotelId);
      });
  }

  /**
   * True when the email comes from the customer's account: it is filled in
   * for them, so they do not have to type it again.
   */
  protected readonly emailFromAccount = computed(() => {
    const email = this.auth.user()?.email ?? '';
    return email.trim().length > 0;
  });

  /** The languages the customer can choose, with the label of each. */
  protected languageOptions = computed(() =>
    SUPPORTED_LANGS.map((code) => ({ label: this.i18n.t(`language.${code}`), value: code })),
  );

  ngOnInit(): void {
    // The customer's current language is the default: they only have to
    // change it when they want another one.
    this.form.controls.language.setValue(this.i18n.currentLang());
    // Entered from the cart's bottom action: start at the form, not mid-page.
    this.scroll.scrollToTop();
  }

  // Hotel/city changes arrive via the selects' (onChange) outputs (proven to
  // fire for mouse, touch and keyboard selection). The quote boundary is the
  // only writer of the fee — see refreshQuote.
  protected onHotelChange(value: unknown): void {
    const id = typeof value === 'string' ? value : '';
    this.selectedHotel.set(id);
  }

  protected onCityChange(value: unknown): void {
    const city = typeof value === 'string' ? value : '';
    this.selectedCity.set(city);
    // Switching cities invalidates a hotel from another city: reset the
    // selection instead of quoting (or charging) the wrong destination.
    const current = this.delivery.hotelById(this.form.get('hotelId')?.value ?? '');
    if (city && current && current.city !== city) {
      this.form.get('hotelId')?.setValue('');
      this.selectedHotel.set('');
      this.quotedFee.set(null);
      this.quoteRateDate.set(null);
    }
  }

  private hotelFeeLabel(hotel: Hotel): string {
    const source = hotel.deliveryFeeCurrency ?? 'USD';
    const resolved = this.prices.resolve(hotel.deliveryFee, source);
    // Rates may still be loading: show the quote in its own currency rather
    // than an error sentence where a price belongs.
    return resolved
      ? this.currency.format(resolved.amount, resolved.currency)
      : this.currency.format(hotel.deliveryFee, source);
  }

  // Asks the quote boundary for the hotel fee and publishes it. Unknown or
  // inactive hotels fail loudly and block submit — never charge a guessed fee.
  private refreshQuote(hotelId: string): void {
    void this.quoteOnce(hotelId);
  }

  /** Fresh quote used at submit time, after prices were re-pulled. */
  private quoteOnce(hotelId: string): Promise<boolean> {
    const seq = ++this.quoteSequence;
    this.quoteFailed.set(false);
    if (!hotelId) {
      this.quotedFee.set(null);
      this.quoteRateDate.set(null);
      this.quotePending.set(false);
      return Promise.resolve(false);
    }
    this.quotedFee.set(null);
    this.quoteRateDate.set(null);
    this.quotePending.set(true);
    return firstValueFrom(this.delivery.quoteFor(hotelId, this.subtotal(), this.currency.code()))
      .then((q) => {
        if (seq !== this.quoteSequence) return false;
        this.quotedFee.set(q.fee);
        this.quoteRateDate.set(q.exchangeRateDate ?? null);
        // The fee and the pending flag flip together: there is no moment in
        // which the total is known but still shown as "calculating".
        this.quotePending.set(false);
        return true;
      })
      .catch(() => {
        if (seq === this.quoteSequence) {
          this.quotedFee.set(null);
          this.quoteFailed.set(true);
          this.quotePending.set(false);
          // The interceptor already shows the localized reason once; the inline
          // state blocks submit until a fee can be trusted again.
        }
        return false;
      });
  }

  /**
   * Validates the coupon against the live backend (mock mode has no coupons).
   * The backend answers 200 with a stable `code` (+ `args`) for ineligible
   * codes, or ProblemDetails on transport/auth failures; both are turned into
   * one localized, customer-readable line — never the generic fallback.
   */
  protected applyCoupon(): void {
    const code = this.couponControl.value.trim();
    this.couponError.set('');
    if (!code) return;
    if (environment.useMockApi) {
      this.couponApplied.set('');
      this.couponDiscount.set(0);
      this.couponError.set(this.i18n.t('checkout.couponInvalid'));
      return;
    }
    this.validateCoupon(code, this.subtotal(), this.currency.code());
  }

  private couponValidationKey(code: string, subtotal: number, currencyCode: string): string {
    return `${code.trim().toUpperCase()}|${currencyCode}|${subtotal.toFixed(2)}`;
  }

  private validateCoupon(code: string, subtotal: number, currencyCode: string): void {
    const normalizedCode = code.trim().toUpperCase();
    const key = this.couponValidationKey(normalizedCode, subtotal, currencyCode);
    if (!normalizedCode || key === this.lastCouponValidationKey) return;

    this.lastCouponValidationKey = key;
    const sequence = ++this.couponValidationSequence;
    this.couponBusy.set(true);
    this.couponDiscount.set(0);
    this.couponError.set('');

    this.api
      .post<CouponValidationResponse>(
        'coupons/validate',
        { code: normalizedCode, subtotal },
        undefined,
        { silent: true },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (sequence !== this.couponValidationSequence) return;
          // Prices may change while the request is in flight. Discard its
          // result and validate again against the current cart total.
          if (currencyCode !== this.currency.code() || subtotal !== this.subtotal()) {
            this.couponBusy.set(false);
            this.validateCoupon(normalizedCode, this.subtotal(), this.currency.code());
            return;
          }
          this.couponBusy.set(false);
          if (res.valid) {
            this.couponApplied.set(normalizedCode);
            this.couponDiscount.set(res.discount);
            return;
          }
          this.couponApplied.set('');
          this.couponDiscount.set(0);
          this.couponError.set(this.apiError.messageForCode(res.code, res.args));
        },
        error: (err: unknown) => {
          if (sequence !== this.couponValidationSequence) return;
          if (currencyCode !== this.currency.code() || subtotal !== this.subtotal()) {
            this.couponBusy.set(false);
            this.validateCoupon(normalizedCode, this.subtotal(), this.currency.code());
            return;
          }
          this.couponBusy.set(false);
          this.couponApplied.set('');
          this.couponDiscount.set(0);
          this.couponError.set(this.apiError.message(err));
        },
      });
  }

  /**
   * Removes an applied promo code. Without this the code could only be
   * replaced by another one, and the discount stayed on the total.
   */
  protected removeCoupon(): void {
    this.couponApplied.set('');
    this.couponDiscount.set(0);
    this.couponError.set('');
    this.lastCouponValidationKey = '';
    this.couponControl.setValue('');
  }

  // Orderable review rows from the shared cart view (same join as the cart
  // page): unavailable lines render separately below and never enter the order.
  protected lines = computed(() =>
    this.view.lines().flatMap((l) =>
      l.unavailable || !l.product
        ? []
        : [{
            key: l.key,
            productId: l.productId,
            name: this.displayName(l.product),
            image: l.product.images[0],
            qty: l.qty,
            total: l.lineTotal,
            unit: l.unit,
            variantLabel: l.variantLabel,
          }],
    ),
  );

  /**
   * The product name in the visitor's language. The order stores this name, so
   * the confirmation and the order history read in the language the customer
   * shopped in.
   */
  private displayName(product: Product): string {
    return pickLocaleText(product.names, this.i18n.currentLang()) || product.name;
  }

  protected unavailableLines = computed(() => this.view.lines().filter((l) => l.unavailable));

  protected subtotal = computed(() => this.view.pricedSubtotal());
  // The ONLY fee writer is the quote boundary (mock sample today, backend
  // quote tomorrow). Free shipping above the configured threshold is the one
  // generic policy allowed here — no per-hotel if/else anywhere.
  protected deliveryFee = computed(() => {
    return this.quotedFee() ?? 0;
  });
  protected total = computed(() => this.subtotal() - this.couponDiscount() + this.deliveryFee());

  protected err(name: string): string | null {
    return firstErrorKey(this.form.get(name));
  }

  /**
   * Money can never be placed from a stale or half-loaded cart: the button is
   * disabled until fresh prices resolved, and the submit handler re-checks.
   * A pending delivery quote blocks it too — the total on screen would
   * otherwise be missing the fee that the order is charged.
   */
  protected checkoutBlocked = computed(
    () =>
      !this.view.ready() ||
      this.view.failed() ||
      this.quoteFailed() ||
      this.quotePending() ||
      this.connectivity.status() === 'offline',
  );

  protected blockedReason = computed(() => {
    if (this.connectivity.status() === 'offline') return this.i18n.t('resilience.offlineBody');
    if (this.view.failed()) return this.i18n.t('resilience.cart.checkoutBlocked');
    if (this.quoteFailed()) return this.i18n.t('errors.deliveryFeeUnavailable');
    return '';
  });

  protected copy(key: keyof SiteCheckoutContent, fallbackKey: string): string {
    const content = this.siteContent.checkout();
    return this.siteContent.text(content?.[key] as import('../../models/product.model').LocalizedText | undefined, this.i18n.currentLang()) || this.i18n.t(fallbackKey);
  }

  protected go(path: string): void {
    this.router.navigate([path]);
  }

  protected async submit(): Promise<void> {
    // Belt and braces: the button disables while placing, but keyboard
    // submits and double taps must also be harmless.
    if (this.placing() || this.couponBusy()) {
      this.notify.info('checkout.duplicateBlocked');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.connectivity.status() === 'offline') {
      this.submitError.set(this.i18n.t('resilience.offlineBody'));
      return;
    }
    if (this.quoteFailed()) {
      // Fast fail when the fee is already known to be untrustworthy.
      this.submitError.set(this.i18n.t('errors.deliveryFeeUnavailable'));
      return;
    }
    this.placing.set(true);
    this.submitError.set('');

    // Money flow: never submit the totals that happen to be on screen. Re-pull
    // the catalog, then re-quote the hotel fee against the fresh subtotal.
    const fresh = await this.view.ensureFresh();
    if (!fresh) {
      this.placing.set(false);
      this.submitError.set(this.i18n.t('resilience.cart.checkoutBlocked'));
      return;
    }
    if (!this.lines().length) {
      // Nothing orderable (empty cart, or only unavailable lines left):
      // explain instead of placing an empty order.
      this.placing.set(false);
      this.submitError.set(this.i18n.t('checkout.emptyCart'));
      return;
    }

    // An item that is no longer available must block the order: the backend
    // would refuse the whole order, and placing it without the item would
    // quietly drop something the customer asked for.
    if (this.unavailableLines().length) {
      this.placing.set(false);
      this.submitError.set(this.i18n.t('checkout.orderProductUnavailable'));
      return;
    }

    // Belt and braces: a line may never hold more than the live stock.
    const overStock = this.view.lines().filter((l) => !l.unavailable && l.product && l.qty > l.stock);
    if (overStock.length) {
      this.placing.set(false);
      this.submitError.set(this.i18n.t('checkout.orderOutOfStock'));
      return;
    }
    const v = this.form.getRawValue();
    const quoteOk = await this.quoteOnce(v.hotelId);
    if (!quoteOk || this.quotedFee() == null) {
      // No trustworthy fee (unknown hotel or failed quote): block instead of
      // charging a guessed amount.
      this.placing.set(false);
      this.submitError.set(this.i18n.t('errors.deliveryFeeUnavailable'));
      return;
    }
    this.submittedKey ??= `ck-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`;
    const key = this.submittedKey;
    const hotel = this.delivery.hotelById(v.hotelId);
    const req: CreateOrderRequest = {
      customer: {
        fullName: v.fullName,
        phone: v.phone,
        email: v.email || undefined,
        city: v.city,
        hotelId: v.hotelId,
        hotelName: hotel?.name ?? v.hotelId,
        room: v.room || undefined,
        notes: v.notes || undefined,
        contactMethod: v.contactMethod,
      },
      language: v.language,
      // The contact method IS the opt-in: WhatsApp updates only when the
      // customer chose WhatsApp. There is no second control.
      whatsappOptIn: v.contactMethod === 'whatsapp',
      items: this.lines().map((l) => ({
        productId: l.productId,
        productName: l.name,
        image: l.image,
        unitPrice: l.unit,
        qty: l.qty,
        variantLabel: l.variantLabel,
      })),
      subtotal: this.subtotal(),
      deliveryFee: this.deliveryFee(),
      total: this.total(),
      currency: this.currency.code(),
      paymentMethod: 'cash_on_delivery',
      couponCode: this.couponApplied() || undefined,
      exchangeRateDate: this.rates.snapshot()?.date ?? this.quoteRateDate() ?? undefined,
    };
    this.orders
      .create(req, key, this.auth.user()?.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.placing.set(false);
          this.submittedKey = null;
          this.cart.clear();
          this.notify.success('checkout.orderSuccess');
          this.router.navigate(['/checkout/confirmation', order.id]);
        },
        error: (err: unknown) => {
          this.placing.set(false);
          const resolved = this.apiError.resolve(err);
          this.submitError.set(this.i18n.t(resolved.key, resolved.params));
          // A coupon rejection is actionable and terminal: drop it so the next
          // attempt can succeed, leaving the exact reason on screen.
          if (resolved.code?.startsWith('coupon_')) {
            this.couponApplied.set('');
            this.couponDiscount.set(0);
            this.submittedKey = null;
          }
          // Stock/price moved under the visitor (or the FX quote expired):
          // re-pull the live catalog so the quantities and prices on screen are
          // current, and end this attempt (fresh idempotency key on retry).
          if (
            resolved.code === 'order_out_of_stock' ||
            resolved.code === 'order_product_unavailable' ||
            resolved.code === 'order_rates_changed'
          ) {
            this.view.refresh();
            this.submittedKey = null;
          }
        },
      });
  }
}

/** 200-shaped response from `POST coupons/validate`. */
interface CouponValidationResponse {
  readonly valid: boolean;
  readonly discount: number;
  readonly reason?: string | null;
  readonly code?: string | null;
  readonly args?: Record<string, unknown> | null;
}
