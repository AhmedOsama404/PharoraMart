import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiClientService } from '../api/api-client.service';

export interface StorefrontLink {
  label: string;
  url: string;
  visible?: boolean;
}

export interface StorefrontSection {
  type: string;
  visible?: boolean;
  maxItems?: number;
  selectionMode?: 'manual' | 'automatic';
  productId?: string;
  mainProductId?: string;
  supportingProductIds?: string[];
  heroProductSlots?: (string | null)[];
  heroIcons?: { badge?: string; primaryCta?: string; secondaryCta?: string; trustItems?: string[] };
  productIds?: string[];
  categoryIds?: string[];
  categoryOverrides?: Record<string, { title?: Partial<Record<string, string>>; description?: Partial<Record<string, string>>; imageUrl?: string; imageAlt?: Partial<Record<string, string>> }>;

  title?: Partial<Record<string, string>>;
  subtitle?: Partial<Record<string, string>>;
  description?: Partial<Record<string, string>>;
  badge?: Partial<Record<string, string>>;
  imageAlt?: Partial<Record<string, string>>;
  imageUrl?: string;
  trustItems?: Partial<Record<string, string>>[];
  ctaLabel?: Partial<Record<string, string>>;
  ctaUrl?: string;
  ctaVisible?: boolean;
  secondaryCtaLabel?: Partial<Record<string, string>>;
  secondaryCtaUrl?: string;
  secondaryCtaVisible?: boolean;
  [key: string]: unknown;
}

interface PublishedConfigResponse {
  version: number;
  status: string;
  updatedAt?: string | null;
  config?: Record<string, unknown> | null;
}

const DEFAULT_ORDER = ['hero', 'categories', 'featured', 'newArrivals', 'popular', 'promo', 'content', 'recentlyViewed'];

/**
 * Published storefront configuration (branding, theme, navigation, homepage,
 * announcements, feature flags). Anonymous read; safe built-in defaults when
 * the backend has never published (or is unreachable in mock mode).
 * Drafts never leak here — only the published revision is served.
 */
@Injectable({ providedIn: 'root' })
export class StorefrontConfigService {
  private readonly api = inject(ApiClientService);
  private readonly payload = signal<Record<string, unknown>>({});
  private loaded = false;
  private lastRequestAt = 0;

  readonly announcements = computed(() => {
    const list = this.payload()['announcements'];
    return Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string' && s.trim() !== '') : [];
  });

  readonly headerLinks = computed<StorefrontLink[]>(() => this.linksOf('headerLinks'));

  headerItemVisible(key: 'home' | 'catalog' | 'orders'): boolean {
    const visibility = this.section('navigation')['headerVisibility'];
    if (visibility === null || typeof visibility !== 'object' || Array.isArray(visibility)) return true;
    return (visibility as Record<string, unknown>)[key] !== false;
  }

  headerItemText(key: 'home' | 'catalog' | 'orders', locale: string, fallback: string): string {
    const labels = this.section('navigation')['headerLabels'];
    if (labels === null || typeof labels !== 'object' || Array.isArray(labels)) return fallback;
    const item = (labels as Record<string, unknown>)[key];
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return fallback;
    const localized = item as Record<string, unknown>;
    const text = localized[locale] ?? localized['en'];
    return typeof text === 'string' && text.trim() ? text.trim() : fallback;
  }

  /** Use configured order, then restore any default sections missing from an incomplete config. */
  readonly sectionOrder = computed<string[]>(() => {
    const home = this.section('homepage');
    const raw = home['sections'];
    if (!Array.isArray(raw)) return [...DEFAULT_ORDER];
    const configured = raw.filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null);
    const declared = new Set(configured.map((s) => String(s['type'] ?? '')).filter((type) => DEFAULT_ORDER.includes(type)));
    const visible = configured
      .filter((s) => s['visible'] !== false)
      .map((s) => String(s['type'] ?? ''))
      .filter((type) => DEFAULT_ORDER.includes(type));
    const uniqueVisible = [...new Set(visible)];
    const missingDefaults = DEFAULT_ORDER.filter((type) => !declared.has(type));
    return [...uniqueVisible, ...missingDefaults];
  });

  /** Type-specific published settings for one homepage section. */
  sectionSettings(type: string): StorefrontSection | null {
    const raw = this.section('homepage')['sections'];
    if (!Array.isArray(raw)) return null;
    const found = raw.find((item) => typeof item === 'object' && item !== null &&
      (item as Record<string, unknown>)['type'] === type) as Record<string, unknown> | undefined;
    return found ? found as StorefrontSection : null;
  }

  sectionText(type: string, field: 'title' | 'subtitle' | 'description' | 'badge' | 'imageAlt' | 'ctaLabel' | 'secondaryCtaLabel', locale: string): string | null {
    const text = this.sectionSettings(type)?.[field];
    if (!text) return null;
    const value = text[locale]?.trim() || text['en']?.trim() || null;
    // Ignore known demo copy accidentally saved by the previous editor preview.
    if (type === 'hero' && value && (value.toLowerCase() === 'hello' || /^test\s+(?:section|description)\b/i.test(value))) return null;
    return value;
  }

  sectionCtaUrl(type: string, secondary = false): string | null {
    const settings = this.sectionSettings(type);
    const url = secondary ? settings?.secondaryCtaUrl : settings?.ctaUrl;
    return typeof url === 'string' && StorefrontConfigService.isSafeUrl(url) ? url : null;
  }

  sectionCtaVisible(type: string, secondary = false): boolean {
    const settings = this.sectionSettings(type);
    const value = secondary ? settings?.secondaryCtaVisible : settings?.ctaVisible;
    return value !== false;
  }

  isFeatureEnabled(flag: string): boolean {
    const features = this.section('features');
    if (!(flag in features)) return true;
    return features[flag] === true;
  }

  /** Loads on startup and refreshes promptly on tab focus without request churn. */
  load(refresh = false): void {
    const now = Date.now();
    if (environment.useMockApi || (this.loaded && (!refresh || now - this.lastRequestAt < 2_000))) return;
    this.loaded = true;
    this.lastRequestAt = now;
    this.api
      .get<PublishedConfigResponse>('storefront/config')
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        const config = res?.config;
        if (!config || typeof config !== 'object') {
          this.loaded = false;
          return;
        }
        this.payload.set(config as Record<string, unknown>);
        this.applyTheme(config as Record<string, unknown>);
        this.applySeo(config as Record<string, unknown>);
      });
  }

  private section(name: string): Record<string, unknown> {
    const value = this.payload()[name];
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private linksOf(key: string): StorefrontLink[] {
    const nav = this.section('navigation');
    const raw = nav[key];
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (l): l is StorefrontLink =>
          typeof l === 'object' && l !== null &&
          typeof (l as Record<string, unknown>)['label'] === 'string' &&
          typeof (l as Record<string, unknown>)['url'] === 'string',
      )
      .map((l) => ({ label: (l as unknown as StorefrontLink).label, url: (l as unknown as StorefrontLink).url, visible: (l as unknown as StorefrontLink).visible }))
      .filter((l) => l.visible !== false && l.label.trim() && StorefrontConfigService.isSafeUrl(l.url));
  }

  private applyTheme(config: Record<string, unknown>): void {
    try {
      const theme = config['theme'];
      if (theme === null || typeof theme !== 'object' || Array.isArray(theme)) return;
      const root = document.documentElement;
      const get = (k: string): string | null => {
        const v = (theme as Record<string, unknown>)[k];
        return typeof v === 'string' ? v : null;
      };
      const primary = get('primaryColor');
      const accent = get('accentColor');
      if (primary && /^#[0-9a-fA-F]{6}$/.test(primary)) root.style.setProperty('--store-primary', primary);
      if (accent && /^#[0-9a-fA-F]{6}$/.test(accent)) root.style.setProperty('--store-accent', accent);
    } catch {
      /* theme is decorative: never break the shop */
    }
  }

  private applySeo(config: Record<string, unknown>): void {
    if (typeof document === 'undefined') return;
    const seo = config['seo'];
    if (seo === null || typeof seo !== 'object' || Array.isArray(seo)) return;
    const values = seo as Record<string, unknown>;
    const title = typeof values['title'] === 'string' ? values['title'].trim() : '';
    const description = typeof values['description'] === 'string' ? values['description'].trim() : '';
    const keywords = typeof values['keywords'] === 'string' ? values['keywords'].trim() : '';
    if (title) {
      document.title = title;
      this.setMeta('og:title', title, 'property');
    }
    if (description) {
      this.setMeta('description', description, 'name');
      this.setMeta('og:description', description, 'property');
    }
    if (keywords) this.setMeta('keywords', keywords, 'name');
  }

  private setMeta(key: string, content: string, selector: 'name' | 'property'): void {
    let element = document.head.querySelector<HTMLMetaElement>(`meta[${selector}="${key}"]`);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(selector, key);
      document.head.appendChild(element);
    }
    element.content = content;
  }

  private static isSafeUrl(url: string): boolean {
    const u = url.trim();
    return (u.startsWith('/') && !u.startsWith('//')) || /^https?:\/\//i.test(u);
  }
}
