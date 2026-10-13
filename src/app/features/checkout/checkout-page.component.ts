import { ChangeDetectionStrategy, Component, computed, inject, signal, type OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Divider } from 'primeng/divider';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
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
import { firstErrorKey, phoneValidator } from '../../shared/utils/validators';
import { handleImgError } from '../../shared/utils/image-fallback.utils';
import type { CreateOrderRequest } from '../../models/order.model';
import type { Hotel } from '../../models/hotel.model';
import { environment } from '../../../environments/environment';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, Button, Card, Divider, InputText, Message,
    Select, Textarea, EmptyStateComponent, MoneyPipe,
  ],
  templateUrl: './checkout-page.component.html',
  styleUrl: './checkout-page.component.scss',
})
export class CheckoutPageComponent implements OnInit {
  protected i18n = inject(I18nService);
  private currency = inject(CurrencyService);
  private fb = inject(FormBuilder);
  protected cart = inject(CartStore);
  protected view = inject(CartViewService);
  private auth = inject(AuthService);
  private orders = inject(OrderService);
  private notify = inject(NotificationService);
  private delivery = inject(DeliveryService);
  private api = inject(ApiClientService);
  private router = inject(Router);
  private scroll = inject(ScrollService);

  protected placing = signal(false);
  protected submitError = signal('');
  // One idempotency key per checkout attempt: double-clicks and retries reuse
  // it, so the order service can never create the order twice.
  private submittedKey: string | null = null;

  protected form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    phone: ['', [Validators.required, phoneValidator]],
    email: ['', [Validators.email]],
    city: ['', [Validators.required]],
    hotelId: ['', [Validators.required]],
    room: [''],
    notes: [''],
    contactMethod: ['phone' as 'phone' | 'whatsapp' | 'email', [Validators.required]],
  });

  // Hotel directory (data-driven; the dashboard can extend it freely).
  protected cities = signal<string[]>([]);
  protected hotels = signal<Hotel[]>([]);
  // Authoritative delivery fee for the chosen hotel. Null = no hotel chosen
  // yet; the quote service (mock today, backend tomorrow) is the only writer.
  protected quotedFee = signal<number | null>(null);
  protected quoteFailed = signal(false);
  // Coupon state (live mode only): the backend validates and prices the code;
  // the receipted discount below is informational until the order returns.
  protected couponControl = new FormControl('', { nonNullable: true });
  protected couponApplied = signal('');
  protected couponDiscount = signal(0);
  protected couponError = signal('');

  // Memoized so p-select keeps a referentially stable options array.
  protected contactOptions = computed(() => [
    { label: this.i18n.t('checkout.contactPhone'), value: 'phone' },
    { label: this.i18n.t('checkout.contactWhatsapp'), value: 'whatsapp' },
    { label: this.i18n.t('checkout.contactEmail'), value: 'email' },
  ]);

  // Hotel dropdown options for the selected city, with the sample fee shown
  // upfront. Memoized for stable p-select references.
  protected hotelOptions = computed(() => {
    const city = this.selectedCity();
    return this.hotels()
      .filter((h) => !city || h.city === city)
      .map((h) => ({
        label: `${h.name}${h.area ? ` — ${h.area}` : ''} · ${this.currency.format(h.deliveryFee)}`,
        value: h.id,
      }));
  });
  protected selectedCity = signal('');

  // City filter options derived from the hotel directory (new cities appear
  // automatically when the dashboard adds hotels there).
  protected cityOptions = computed(() => this.cities().map((c) => ({ label: c, value: c })));

  constructor() {
    this.delivery.hotels().subscribe((list) => this.hotels.set(list));
    this.delivery.cities().subscribe((list) => this.cities.set(list));
    // Pre-fill from the demo session when available; guests fill it manually.
    const u = this.auth.user();
    if (u) {
      this.form.patchValue({ fullName: u.name, email: u.email, phone: u.phone ?? '' });
    }
  }

  ngOnInit(): void {
    // Entered from the cart's bottom action: start at the form, not mid-page.
    this.scroll.scrollToTop();
  }

  // Hotel/city changes arrive via the selects' (onChange) outputs (proven to
  // fire for mouse, touch and keyboard selection). The quote boundary is the
  // only writer of the fee — see refreshQuote.
  protected onHotelChange(value: unknown): void {
    const id = typeof value === 'string' ? value : '';
    this.refreshQuote(id);
  }

  protected onCityChange(value: unknown): void {
    const city = typeof value === 'string' ? value : '';
    this.selectedCity.set(city);
    // Switching cities invalidates a hotel from another city: reset the
    // selection instead of quoting (or charging) the wrong destination.
    const current = this.delivery.hotelById(this.form.get('hotelId')?.value ?? '');
    if (city && current && current.city !== city) {
      this.form.get('hotelId')?.setValue('');
      this.quotedFee.set(null);
    }
  }

  // Asks the quote boundary for the hotel fee and publishes it. Unknown or
  // inactive hotels fail loudly and block submit — never charge a guessed fee.
  private refreshQuote(hotelId: string): void {
    this.quoteFailed.set(false);
    if (!hotelId) {
      this.quotedFee.set(null);
      return;
    }
    this.delivery.quoteFor(hotelId, this.subtotal(), 'USD').subscribe({
      next: (q) => this.quotedFee.set(q.fee),
      error: () => {
        this.quotedFee.set(null);
        this.quoteFailed.set(true);
        this.notify.error('notifications.loadFailed');
      },
    });
  }

  /** Validates the coupon against the live backend (mock mode has no coupons). */
  protected applyCoupon(): void {
    const code = this.couponControl.value.trim();
    this.couponError.set('');
    if (!code) return;
    if (environment.useMockApi) {
      this.couponError.set(this.i18n.t('checkout.couponInvalid'));
      return;
    }
    this.api
      .post<{ valid: boolean; discount: number; reason?: string | null }>('coupons/validate', {
        code,
        subtotal: this.subtotal(),
      })
      .subscribe({
        next: (res) => {
          if (res.valid) {
            this.couponApplied.set(code.toUpperCase());
            this.couponDiscount.set(res.discount);
          } else {
            this.couponApplied.set('');
            this.couponDiscount.set(0);
            this.couponError.set(res.reason ?? this.i18n.t('checkout.couponInvalid'));
          }
        },
        error: () => this.couponError.set(this.i18n.t('checkout.couponInvalid')),
      });
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
            name: l.product.name,
            image: l.product.images[0],
            qty: l.qty,
            total: l.lineTotal,
            unit: l.unit,
            variantLabel: l.variantLabel,
          }],
    ),
  );

  protected unavailableLines = computed(() => this.view.lines().filter((l) => l.unavailable));

  protected subtotal = computed(() => this.view.pricedSubtotal());
  // The ONLY fee writer is the quote boundary (mock sample today, backend
  // quote tomorrow). Free shipping above the configured threshold is the one
  // generic policy allowed here — no per-hotel if/else anywhere.
  protected deliveryFee = computed(() => {
    if (this.subtotal() <= 0 || this.subtotal() >= environment.freeShippingThreshold) return 0;
    return this.quotedFee() ?? 0;
  });
  protected total = computed(() => this.subtotal() - this.couponDiscount() + this.deliveryFee());

  protected err(name: string): string | null {
    return firstErrorKey(this.form.get(name));
  }

  // Review thumbnails share the two-stage recovery (fixed-size box).
  protected imgFallback(ev: Event, seed: string): void {
    handleImgError(ev, seed);
  }

  protected go(path: string): void {
    this.router.navigate([path]);
  }

  protected submit(): void {
    // Belt and braces: the button disables while placing, but keyboard
    // submits and double taps must also be harmless.
    if (this.placing()) {
      this.notify.info('checkout.duplicateBlocked');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.lines().length) {
      // Nothing orderable (empty cart, or only unavailable lines left):
      // explain instead of placing an empty order.
      this.submitError.set(this.i18n.t('checkout.emptyCart'));
      return;
    }
    if (this.quoteFailed() || this.quotedFee() == null) {
      // No trustworthy fee (unknown hotel or failed quote): block instead of
      // charging a guessed amount.
      this.submitError.set(this.i18n.t('errors.generic'));
      return;
    }
    this.placing.set(true);
    this.submitError.set('');
    this.submittedKey ??= `ck-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`;
    const key = this.submittedKey;
    const v = this.form.getRawValue();
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
      currency: 'USD',
      paymentMethod: 'cash_on_delivery',
      couponCode: this.couponApplied() || undefined,
    };
    this.orders.create(req, key, this.auth.user()?.id).subscribe({
      next: (order) => {
        this.placing.set(false);
        this.submittedKey = null;
        this.cart.clear();
        this.notify.success('checkout.orderSuccess');
        this.router.navigate(['/checkout/confirmation', order.id]);
      },
      error: () => {
        this.placing.set(false);
        this.submitError.set(this.i18n.t('errors.generic'));
        this.notify.error('notifications.loadFailed');
      },
    });
  }
}
