import { Injectable, computed } from '@angular/core';

export interface StorefrontSection {
  type: string;
  visible?: boolean;
  maxItems?: number;
  selectionMode?: 'manual' | 'automatic';
  productId?: string;
  productIds?: string[];
  categoryIds?: string[];
  imageUrl?: string;
  heroIcons?: { badge?: string };
  [key: string]: unknown;
}

const HOME_ORDER = ['hero', 'categories', 'featured', 'newArrivals', 'popular', 'promo', 'content', 'recentlyViewed'];

/** Built-in presentation defaults; all editable website content lives in SiteContentService. */
@Injectable({ providedIn: 'root' })
export class StorefrontDefaultsService {
  readonly headerLinks = computed(() => [] as { label: string; url: string; visible?: boolean }[]);
  readonly sectionOrder = computed(() => [...HOME_ORDER]);

  headerItemVisible(_key: 'home' | 'catalog' | 'orders'): boolean { return true; }
  headerItemText(_key: 'home' | 'catalog' | 'orders', _locale: string, fallback: string): string { return fallback; }
  sectionSettings(_type: string): StorefrontSection | null { return null; }
  sectionText(_type: string, _field: 'title' | 'subtitle' | 'description' | 'badge' | 'imageAlt' | 'ctaLabel' | 'secondaryCtaLabel', _locale: string): string | null { return null; }
  sectionCtaUrl(_type: string, _secondary = false): string | null { return null; }
  sectionCtaVisible(_type: string, _secondary = false): boolean { return true; }
  isFeatureEnabled(_flag: string): boolean { return true; }
}
