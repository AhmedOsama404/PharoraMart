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
  logoUrl: string | null;
  announcementText: LocalizedText;
  announcementVisible: boolean;
}

export interface SiteHero {
  badge: LocalizedText;
  headline: LocalizedText;
  description: LocalizedText;
  primaryButton: SiteButton;
  secondaryButton: SiteButton;
  highlights: SiteHighlight[];
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
  featured: SiteHomeSection;
  newArrivals: SiteHomeSection;
  popular: SiteHomeSection;
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
  logoUrl: string | null;
  brandName: LocalizedText;
  tagline: LocalizedText;
  contacts: SiteFooterContact[];
  columns: SiteFooterColumn[];
  copyrightText: LocalizedText;
  noticeText: LocalizedText;
}

/** One anonymous read feeds the header, home page and footer. */
export interface SiteContent {
  header: SiteHeader;
  hero: SiteHero;
  categoriesSection: SiteCategoriesSection;
  homeSections: SiteHomeSections;
  footer: SiteFooter;
}
