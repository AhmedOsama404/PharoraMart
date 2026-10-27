import type { LocalizedText } from './product.model';

// Published, employee-editable storefront content served by
// GET /api/v1/site-content (see PharoraMart.Application.Dtos.SiteContentDtos).
// Every user-visible string is per-language; icons are allow-listed PrimeIcons
// class strings resolved through SiteContentService.icon(). The shape is always
// complete server-side — a missing section degrades to blank values.

export interface SiteButton {
  label: LocalizedText;
  icon: string;
  url: string;
}

export interface SiteHighlight {
  icon: string;
  text: LocalizedText;
}

export interface SiteHeader {
  brandName: LocalizedText;
  logoUrl: string;
  announcementText: LocalizedText;
  announcementVisible: boolean;
}

export interface SiteHero {
  badge: LocalizedText;
  headline: LocalizedText;
  description: LocalizedText;
  primaryButton: SiteButton | null;
  secondaryButton: SiteButton | null;
  highlights: SiteHighlight[];
  productIds: (string | null)[];
}

export interface SiteCategoriesSection {
  sectionTitle: LocalizedText;
  sectionBody: LocalizedText;
}

export interface SiteHomeSection {
  title: LocalizedText;
  body: LocalizedText;
  isVisible: boolean;
  viewAllText: LocalizedText;
  viewAllUrl: string;
}

export interface SiteHomeSections {
  featured: SiteHomeSection | null;
  newArrivals: SiteHomeSection | null;
  popular: SiteHomeSection | null;
}

export interface SiteCheckoutContent {
  title: LocalizedText;
  subtitle: LocalizedText;
  contactTitle: LocalizedText;
  addressTitle: LocalizedText;
  paymentTitle: LocalizedText;
  paymentMethodTitle: LocalizedText;
  paymentMethodBody: LocalizedText;
  reviewTitle: LocalizedText;
  placeOrderLabel: LocalizedText;
  backToCartLabel: LocalizedText;
  showCouponEntry: boolean;
  /** Optional sub-headings under each card title (blank = built-in wording). */
  contactSubtitle: LocalizedText;
  addressSubtitle: LocalizedText;
  paymentSubtitle: LocalizedText;
  reviewSubtitle: LocalizedText;
  /** The place-order call to action: its PrimeIcons class and its visual tone. */
  placeOrderIcon: string;
  placeOrderTone: string;
}

export interface SiteOrderConfirmationContent {
  title: LocalizedText;
  subtitle: LocalizedText;
  deliveryTitle: LocalizedText;
  nextStepsTitle: LocalizedText;
  nextStepOne: LocalizedText;
  nextStepTwo: LocalizedText;
  nextStepThree: LocalizedText;
  whatsAppButtonLabel: LocalizedText;
  whatsAppHint: LocalizedText;
  emailButtonLabel: LocalizedText;
  emailHint: LocalizedText;
  continueShoppingLabel: LocalizedText;
  viewOrdersLabel: LocalizedText;
  showNextSteps: boolean;
  showWhatsAppButton: boolean;
  showEmailButton: boolean;
  showDemoNotice: boolean;
  /** The "how to reach us" block: its heading and whether the channels show. */
  contactTitle: LocalizedText;
  showContactDetails: boolean;
}

export interface SiteFooterContact {
  icon: string;
  text: LocalizedText;
}

export interface SiteFooterLink {
  text: LocalizedText;
  url: string;
}

export interface SiteFooterColumn {
  header: LocalizedText;
  links: SiteFooterLink[];
}

export interface SiteFooter {
  logoUrl: string;
  brandName: LocalizedText;
  tagline: LocalizedText;
  contacts: SiteFooterContact[];
  columns: SiteFooterColumn[];
  copyrightText: LocalizedText;
  noticeText: LocalizedText;
}

/**
 * One anonymous read feeds the header, home page and footer.
 *
 * A section is null when the payload does not carry it; every field inside a
 * section is always present with a usable type, so the templates can
 * dereference them without a guard (see SiteContentService).
 */
export interface SiteContent {
  header: SiteHeader | null;
  hero: SiteHero | null;
  categoriesSection: SiteCategoriesSection | null;
  homeSections: SiteHomeSections;
  footer: SiteFooter | null;
  checkout: SiteCheckoutContent | null;
  orderConfirmation: SiteOrderConfirmationContent | null;
}
