import type { LocalizedText } from './product.model';

/**
 * An active sales campaign, served by the public GET /api/v1/coupons/active
 * (see PharoraMart.Application.Dtos.CouponDto). The endpoint only ever returns
 * campaigns that are currently eligible in time and not exhausted; the
 * storefront therefore never needs to re-check windows or usage when deciding
 * what to display — an item in this list IS active. Basket scope (which
 * products/categories it covers) is decided here, against the live cart.
 */
export interface Campaign {
  id: string;
  code: string;
  name: string;
  isPercentage: boolean;
  value: number;
  maxDiscount: number | null;
  minOrderAmount: number;
  startsAt: string | null;
  endsAt: string | null;
  maxUses: number | null;
  usedCount: number;
  maxUsesPerCustomer: number | null;
  productIds: string[];
  categoryIds: string[];
  isActive: boolean;
  createdAt: string;
  bannerImageUrl: string;
  accentColor: string;
  badgeText: LocalizedText | null;
  headline: LocalizedText | null;
  subtext: LocalizedText | null;
}
