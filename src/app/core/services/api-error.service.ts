import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { asProblemDetails, type ProblemDetails } from '../api/problem-details';
import { I18nService } from './i18n.service';
import { CurrencyService } from './currency.service';
import { PriceResolverService } from './price-resolver.service';

/**
 * One resolved, ready-to-render failure. `key` is always an i18n key in the
 * `errors.*` namespace, so every surface (toast, inline banner, message
 * component) shows localized text — never the backend's English `detail`.
 */
export interface ResolvedApiError {
  /** i18n key (always present, safe to render). */
  readonly key: string;
  /** Interpolation values for the key (never raw backend prose). */
  readonly params?: Record<string, string | number>;
  /** Stable backend business code, when the response carried one. */
  readonly code?: string;
  /** HTTP status (0 = network/offline). */
  readonly status: number;
  /** English diagnostic, for logs only — do not render. */
  readonly detail?: string;
  /** Field-level messages (English) for logging/support. */
  readonly fieldErrors?: Record<string, readonly string[]>;
}

/**
 * Maps backend failures (RFC 7807 `application/problem+json`) to localized
 * messages. The backend is the source of truth: it ships a stable, language
 * neutral `code` plus any values a message needs in `args`; this service turns
 * that into one of the storefront's eight dictionaries. Unknown codes and
 * transport failures fall back to a status-derived key, so a user always gets
 * a readable, translated message — never a raw key or English stack prose.
 */
@Injectable({ providedIn: 'root' })
export class ApiErrorService {
  private readonly i18n = inject(I18nService);
  private readonly currency = inject(CurrencyService);
  private readonly prices = inject(PriceResolverService);

  /** Business code → i18n key. Mirrors BusinessErrorCodes on the backend. */
  private static readonly CODE_KEYS: Readonly<Record<string, string>> = {
    // Coupons
    coupon_required: 'errors.couponRequired',
    coupon_unknown: 'errors.couponUnknown',
    coupon_inactive: 'errors.couponInactive',
    coupon_expired: 'errors.couponExpired',
    coupon_exhausted: 'errors.couponExhausted',
    coupon_already_used: 'errors.couponAlreadyUsed',
    coupon_min_order: 'errors.couponMinOrder',
    coupon_not_applicable: 'errors.couponNotApplicable',
    coupon_has_redemptions: 'errors.couponHasRedemptions',
    coupon_duplicate: 'errors.couponDuplicate',
    // Authentication
    auth_invalid_credentials: 'errors.invalidCredentials',
    auth_email_taken: 'errors.emailTaken',
    password_reset_unavailable: 'errors.passwordResetUnavailable',
    auth_current_password_incorrect: 'errors.currentPasswordIncorrect',
    password_reset_invalid: 'errors.passwordResetInvalid',
    password_reset_expired: 'errors.passwordResetExpired',
    password_reset_used: 'errors.passwordResetUsed',
    email_verification_invalid: 'errors.emailVerificationInvalid',
    email_verification_expired: 'errors.emailVerificationExpired',
    email_verification_used: 'errors.emailVerificationUsed',
    // Order placement
    order_hotel_unavailable: 'errors.orderHotelUnavailable',
    order_currency_unavailable: 'errors.orderCurrencyUnavailable',
    order_rates_changed: 'errors.orderRatesChanged',
    order_product_unavailable: 'errors.orderProductUnavailable',
    order_out_of_stock: 'errors.orderOutOfStock',
    order_currency_unsupported: 'errors.orderCurrencyUnsupported',
    // Transport
    validation_failed: 'errors.invalidInput',
    unauthorized: 'errors.sessionExpired',
    forbidden: 'errors.forbidden',
    not_found: 'errors.notFound',
    conflict: 'errors.conflict',
    too_many_requests: 'errors.tooManyRequests',
    unavailable: 'errors.serverUnavailable',
    error: 'errors.generic',
  };

  /** Status → i18n key, used when the body carries no (known) code. */
  private static readonly STATUS_KEYS: Readonly<Record<number, string>> = {
    0: 'errors.network',
    400: 'errors.invalidInput',
    401: 'errors.sessionExpired',
    403: 'errors.forbidden',
    404: 'errors.notFound',
    409: 'errors.conflict',
    422: 'errors.invalidInput',
    429: 'errors.tooManyRequests',
    503: 'errors.serverUnavailable',
  };

  /** Resolve any thrown error into a localized, renderable failure. */
  resolve(err: unknown): ResolvedApiError {
    const status = err instanceof HttpErrorResponse ? err.status : 0;
    const body = this.problemOf(err);
    return this.fromBody(body, status);
  }

  /** Localized, ready-to-display text for a failure. */
  message(err: unknown): string {
    const resolved = this.resolve(err);
    return this.i18n.t(resolved.key, resolved.params);
  }

  /**
   * Localized text for a success-shaped response that carries a business code
   * (`coupons/validate` returns 200 with `{ valid: false, code, args }`).
   */
  messageForCode(code: string | null | undefined, args?: Record<string, unknown> | null): string {
    const resolved = this.fromBody({ code: code ?? undefined, args: args ?? undefined }, 422);
    return this.i18n.t(resolved.key, resolved.params);
  }

  /** Resolve a specific business code (and optional args) into a failure. */
  fromBody(body: ProblemDetails | null, status = 422): ResolvedApiError {
    const code = body?.code;
    const key =
      (code && ApiErrorService.CODE_KEYS[code]) ||
      ApiErrorService.STATUS_KEYS[status] ||
      (status >= 500 ? 'errors.server' : 'errors.generic');

    return {
      key,
      params: this.paramsFor(body?.args),
      code,
      status,
      detail: body?.detail,
      fieldErrors: body?.errors,
    };
  }

  private problemOf(err: unknown): ProblemDetails | null {
    if (err instanceof HttpErrorResponse) return asProblemDetails(err.error);
    return asProblemDetails(err);
  }

  /**
   * Turn language-neutral backend `args` into template values, formatting any
   * monetary amount in the visitor's selected currency (the backend expresses
   * coupon minimums in the store's base currency).
   */
  private paramsFor(args: Record<string, unknown> | undefined): Record<string, string | number> | undefined {
    if (!args) return undefined;

    const params: Record<string, string | number> = {};
    const rawAmount = args['minOrderAmount'];
    if (typeof rawAmount === 'number') {
      params['amount'] = this.formatAmount(rawAmount, 'USD');
    }

    const couponCode = args['couponCode'];
    if (typeof couponCode === 'string') {
      params['code'] = couponCode;
    }

    return Object.keys(params).length ? params : undefined;
  }

  private formatAmount(amount: number, sourceCode: string): string {
    const resolved = this.prices.resolve(amount, sourceCode);
    return resolved
      ? this.currency.format(resolved.amount, resolved.currency)
      : this.currency.format(amount);
  }
}
