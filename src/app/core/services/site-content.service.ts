import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiClientService } from '../api/api-client.service';
import type { LocalizedText } from '../../models/product.model';
import type {
  SiteCategoriesSection,
  SiteContent,
  SiteFooter,
  SiteHeader,
  SiteHero,
  SiteHomeSection,
} from '../../models/site-content.model';

/** PrimeIcons classes editable content may use (mirrors PharoraMart.Domain.SiteIcons). */
const ALLOWED_ICONS = new Set<string>([
  'pi pi-shopping-bag',
  'pi pi-building',
  'pi pi-truck',
  'pi pi-money-bill',
  'pi pi-refresh',
  'pi pi-envelope',
  'pi pi-whatsapp',
  'pi pi-clock',
  'pi pi-heart',
  'pi pi-star',
  'pi pi-map-marker',
  'pi pi-phone',
  'pi pi-tag',
  'pi pi-gift',
  'pi pi-globe',
  'pi pi-user',
  'pi pi-check-circle',
  'pi pi-shield',
  'pi pi-leaf',
]);

const ICON_FALLBACK = 'pi pi-tag';

export type HomeSectionKey = 'featured' | 'newArrivals' | 'popular';

/**
 * Employee-editable storefront content (header, hero, categories heading, the
 * three home product sections, footer). Loaded once per session; every getter
 * degrades to empty so a failed or absent payload never crashes the shop and
 * never resurrects hardcoded copy.
 */
@Injectable({ providedIn: 'root' })
export class SiteContentService {
  private readonly api = inject(ApiClientService);
  private readonly payload = signal<SiteContent | null>(null);
  private loaded = false;

  readonly header = computed<SiteHeader | null>(() => this.payload()?.header ?? null);
  readonly hero = computed<SiteHero | null>(() => this.payload()?.hero ?? null);
  readonly categoriesSection = computed<SiteCategoriesSection | null>(() => this.payload()?.categoriesSection ?? null);
  readonly footer = computed<SiteFooter | null>(() => this.payload()?.footer ?? null);

  /** The home-section card (featured / new-arrivals / popular), or null. */
  homeSection(key: HomeSectionKey): SiteHomeSection | null {
    return this.payload()?.homeSections?.[key] ?? null;
  }

  /**
   * Product sections stay visible unless an employee explicitly hid them, so a
   * missing payload still lists products (with empty headings) rather than
   * blanking the shop.
   */
  homeSectionVisible(key: HomeSectionKey): boolean {
    return this.homeSection(key)?.isVisible !== false;
  }

  /** Localized value for the active language, falling back to English. */
  text(value: LocalizedText | null | undefined, locale: string): string {
    if (!value) return '';
    const record = value as unknown as Record<string, string | undefined>;
    return (record[locale] ?? '').trim() || (record['en'] ?? '').trim();
  }

  /** Allow-listed PrimeIcons class for a stored value, else the fallback. */
  icon(value: string | null | undefined, fallback: string = ICON_FALLBACK): string {
    const trimmed = (value ?? '').trim();
    return ALLOWED_ICONS.has(trimmed) ? trimmed : fallback;
  }

  /** A stored link if it is an in-store path or an http(s) URL, else ''. */
  safeUrl(url: string | null | undefined): string {
    const trimmed = (url ?? '').trim();
    return SiteContentService.isSafeUrl(trimmed) ? trimmed : '';
  }

  externalLink(url: string | null | undefined): boolean {
    return /^https?:\/\//i.test((url ?? '').trim());
  }

  isRelative(url: string | null | undefined): boolean {
    const trimmed = (url ?? '').trim();
    return trimmed.startsWith('/') && !trimmed.startsWith('//');
  }

  /** Fetches once per session; a failure simply leaves the content empty. */
  load(): void {
    if (this.loaded || environment.useMockApi) return;
    this.loaded = true;
    this.api
      .get<SiteContent>('site-content')
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (res && typeof res === 'object') this.payload.set(res);
      });
  }

  private static isSafeUrl(url: string): boolean {
    return (url.startsWith('/') && !url.startsWith('//')) || /^https?:\/\//i.test(url);
  }
}
