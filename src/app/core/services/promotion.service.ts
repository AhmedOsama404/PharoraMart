import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, finalize, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiClientService } from '../api/api-client.service';
import { resolveMediaUrl } from '../../shared/utils/media-url.utils';
import { I18nService } from './i18n.service';
import { SUPPORTED_LANGS } from '../config/i18n.config';
import type { Campaign } from '../../models/promotion.model';
import type { LocalizedText } from '../../models/product.model';

const LOAD_FAILED = Symbol('promotion-load-failed');

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function toLocalized(value: unknown): LocalizedText | null {
  const src = isPlainObject(value) ? value : {};
  const en = toText(src['en']);
  const text: LocalizedText = { en };
  let usable = en.length > 0;
  for (const lang of SUPPORTED_LANGS) {
    if (lang === 'en') continue;
    const raw = src[lang];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      text[lang] = raw.trim();
      usable = true;
    }
  }
  return usable ? text : null;
}

function toCampaign(raw: unknown): Campaign | null {
  if (!isPlainObject(raw)) return null;
  return {
    id: toText(raw['id']),
    code: toText(raw['code']),
    name: toText(raw['name']),
    isPercentage: raw['isPercentage'] === true,
    value: toNumber(raw['value']),
    maxDiscount: toNullableNumber(raw['maxDiscount']),
    minOrderAmount: toNumber(raw['minOrderAmount']),
    startsAt: toText(raw['startsAt']),
    endsAt: toText(raw['endsAt']),
    maxUses: toNullableNumber(raw['maxUses']),
    usedCount: toNumber(raw['usedCount']),
    maxUsesPerCustomer: toNullableNumber(raw['maxUsesPerCustomer']),
    productIds: toStringArray(raw['productIds']),
    categoryIds: toStringArray(raw['categoryIds']),
    isActive: raw['isActive'] === true,
    createdAt: toText(raw['createdAt']),
    bannerImageUrl: toText(raw['bannerImageUrl']),
    accentColor: toText(raw['accentColor']),
    badgeText: toLocalized(raw['badgeText']),
    headline: toLocalized(raw['headline']),
    subtext: toLocalized(raw['subtext']),
  };
}

/** A product-card campaign badge: its label, accent color and provenance. */
export interface CampaignBadge {
  label: string;
  accent: string;
  /** 'authored' = admin badge text; 'percent' = synthesized from the coupon rate. */
  kind: 'authored' | 'percent';
}

/**
 * Sales campaigns for the storefront. Loaded once per session from the public
 * active-coupons endpoint; the list is sanitized and the service only ever
 * surfaces campaigns the backend marked active, so an expired or inactive
 * campaign can never be rendered as live.
 */
@Injectable({ providedIn: 'root' })
export class PromotionService {
  private readonly api = inject(ApiClientService);
  private readonly i18n = inject(I18nService);
  private readonly campaigns = signal<Campaign[]>([]);
  private readonly loaded = signal(false);
  readonly ready = this.loaded.asReadonly();
  private inFlight = false;
  private lastRequestAt = 0;

  /** Campaigns carrying presentation copy (badge, headline or subtext). */
  readonly featured = computed(() => this.campaigns().filter((c) => c.badgeText || c.headline || c.subtext));

  /** Localized value for the active language, falling back to English. */
  text(value: LocalizedText | null | undefined, locale: string): string {
    if (!value || typeof value !== 'object') return '';
    const record = value as unknown as Record<string, unknown>;
    const pick = (key: string): string => {
      const raw = record[key];
      return typeof raw === 'string' ? raw.trim() : '';
    };
    return pick(locale) || pick('en');
  }

  /** Resolved banner image URL, '' when none. */
  bannerUrl(campaign: Campaign): string {
    return campaign.bannerImageUrl ? resolveMediaUrl(campaign.bannerImageUrl) : '';
  }

  /** Whether a campaign covers the given product/category (site-wide = both empty). */
  covers(campaign: Campaign, productId: string, categoryId: string): boolean {
    if (campaign.productIds.length === 0 && campaign.categoryIds.length === 0) return true;
    if (campaign.productIds.includes(productId)) return true;
    return categoryId !== '' && campaign.categoryIds.includes(categoryId);
  }

  /**
   * The active campaign banner to show on a product detail page: the first
   * active campaign covering the product that carries any presentation copy.
   */
  bannerFor(productId: string, categoryId: string): Campaign | null {
    for (const campaign of this.campaigns()) {
      if (!campaign.isActive) continue;
      if (!this.covers(campaign, productId, categoryId)) continue;
      if (campaign.badgeText || campaign.headline || campaign.subtext || campaign.bannerImageUrl) {
        return campaign;
      }
    }
    return null;
  }

  /**
   * The badge a product card shows for this product. Only campaigns that the
   * backend marked active, that cover the product, and that carry presentation
   * copy qualify. A plain promo code (no badge text, headline, subtext or
   * banner) is checkout-only: it never paints a per-product discount on a card,
   * because the discount applies only when the code is entered at checkout.
   * The label is the admin-authored badge text, or — for a percentage campaign —
   * the coupon's own rate, so a displayed discount always matches what checkout
   * applies. A fixed-amount campaign without badge text is order-level, not
   * product-level, so it never paints a per-product price on a card.
   */
  badgeFor(productId: string, categoryId: string): CampaignBadge | null {
    const lang = this.i18n.currentLang();
    for (const campaign of this.campaigns()) {
      if (!campaign.isActive) continue;
      if (!this.covers(campaign, productId, categoryId)) continue;
      if (!campaign.badgeText && !campaign.headline && !campaign.subtext && !campaign.bannerImageUrl) {
        continue;
      }
      const authored = this.text(campaign.badgeText, lang);
      if (authored) {
        return { label: authored, accent: campaign.accentColor, kind: 'authored' };
      }
      if (campaign.isPercentage && campaign.value > 0) {
        return { label: this.i18n.t('product.off', { percent: Math.round(campaign.value) }), accent: campaign.accentColor, kind: 'percent' };
      }
    }
    return null;
  }

  /** Loads on startup and refreshes promptly on tab focus, one request at a time. */
  load(refresh = false): void {
    const now = Date.now();
    if (environment.useMockApi) {
      this.loaded.set(true);
      return;
    }
    if (this.inFlight) return;
    if (this.loaded() && (!refresh || now - this.lastRequestAt < 2_000)) return;
    this.inFlight = true;
    this.lastRequestAt = now;
    this.api
      .get<unknown>('coupons/active', undefined, { silent: true })
      .pipe(
        finalize(() => (this.inFlight = false)),
        catchError(() => of(LOAD_FAILED)),
      )
      .subscribe((res) => {
        if (res === LOAD_FAILED) {
          this.loaded.set(true);
          return;
        }
        const list = Array.isArray(res) ? res.map(toCampaign).filter((c): c is Campaign => c !== null) : [];
        this.campaigns.set(list);
        this.loaded.set(true);
      });
  }
}
