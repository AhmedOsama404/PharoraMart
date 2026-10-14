import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiClientService } from '../api/api-client.service';

export interface StorefrontLink {
  label: string;
  url: string;
}

export interface StorefrontSection {
  type: string;
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

  readonly announcements = computed(() => {
    const list = this.payload()['announcements'];
    return Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string' && s.trim() !== '') : [];
  });

  readonly footerLinks = computed<StorefrontLink[]>(() => this.linksOf('footerLinks'));
  readonly headerLinks = computed<StorefrontLink[]>(() => this.linksOf('headerLinks'));

  /** Homepage section types in dashboard order (unknown types dropped). */
  readonly sectionOrder = computed<string[]>(() => {
    const home = this.section('homepage');
    const raw = home['sections'];
    if (!Array.isArray(raw)) return DEFAULT_ORDER;
    const ordered = raw
      .map((s) => (typeof s === 'object' && s !== null ? String((s as Record<string, unknown>)['type'] ?? '') : ''))
      .filter((t) => DEFAULT_ORDER.includes(t));
    const missing = DEFAULT_ORDER.filter((t) => !ordered.includes(t));
    return [...ordered, ...missing];
  });

  /** Whether a homepage section renders (promo/content also need their data). */
  showSection(type: string): boolean {
    if (type === 'promo' || type === 'content' || type === 'recentlyViewed') return true;
    return this.sectionOrder().includes(type);
  }

  isFeatureEnabled(flag: string): boolean {
    const features = this.section('features');
    if (!(flag in features)) return true;
    return features[flag] === true;
  }

  brandName(fallback: string): string {
    const name = this.section('branding')['storeName'];
    return typeof name === 'string' && name.trim() ? name : fallback;
  }

  /** Fetches once per session; applies theme tokens as CSS variables. */
  load(): void {
    if (this.loaded || environment.useMockApi) return;
    this.loaded = true;
    this.api
      .get<PublishedConfigResponse>('storefront/config')
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        const config = res?.config;
        if (!config || typeof config !== 'object') return;
        this.payload.set(config as Record<string, unknown>);
        this.applyTheme(config as Record<string, unknown>);
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
      .map((l) => ({ label: (l as unknown as StorefrontLink).label, url: (l as unknown as StorefrontLink).url }))
      .filter((l) => l.label.trim() && StorefrontConfigService.isSafeUrl(l.url));
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

  private static isSafeUrl(url: string): boolean {
    const u = url.trim();
    return (u.startsWith('/') && !u.startsWith('//')) || /^https?:\/\//i.test(u);
  }
}
