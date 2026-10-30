import type { LocalizedText } from './product.model';

/**
 * The storefront brand/theme served by GET /api/v1/store/theme (see
 * PharoraMart.Application.Dtos.ThemeDto). The public endpoint always answers:
 * a published theme (rowVersion >= 1) or the built-in identity (rowVersion 0)
 * when nothing has been published yet. Media fields carry the resolved public
 * URL; every user-visible string is per-language (LocalizedText, English
 * required, other languages optional).
 */
export interface StorefrontTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  /** '' when the backend published no explicit card surface. */
  surfaceColor: string;
  /** '' when the backend published no explicit body text color. */
  textColor: string;
  fontFamily: string;
  logoUrl: string;
  faviconUrl: string;
  socialShareUrl: string;
  metaTitle: LocalizedText | null;
  metaDescription: LocalizedText | null;
  metaKeywords: LocalizedText | null;
  promoHeadline: LocalizedText | null;
  promoBody: LocalizedText | null;
  promoBadge: LocalizedText | null;
  promoCtaLabel: LocalizedText | null;
  promoCtaUrl: string;
  promoImageUrl: string;
  /** 2-letter ISO country code the phone picker defaults to. */
  defaultPhoneCountry: string;
  isPublished: boolean;
  /** 0 = the built-in identity (nothing published yet); >= 1 = a real theme. */
  rowVersion: number;
  updatedAt: string;
}
