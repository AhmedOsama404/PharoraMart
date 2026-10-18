import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiClientService } from '../api/api-client.service';
import { resolveMediaUrl } from '../../shared/utils/media-url.utils';
import type { LocalizedText } from '../../models/product.model';
import type {
  SiteCategoriesSection,
  SiteContent,
  SiteCheckoutContent,
  SiteFooter,
  SiteHeader,
  SiteHero,
  SiteHomeSection,
  SiteOrderConfirmationContent,
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
  private readonly contentLoaded = signal(false);
  readonly ready = this.contentLoaded.asReadonly();
  private lastRequestAt = 0;

  readonly header = computed<SiteHeader | null>(() => this.payload()?.header ?? null);
  readonly hero = computed<SiteHero | null>(() => this.payload()?.hero ?? null);
  readonly categoriesSection = computed<SiteCategoriesSection | null>(() => this.payload()?.categoriesSection ?? null);
  readonly footer = computed<SiteFooter | null>(() => this.payload()?.footer ?? null);
  readonly checkout = computed<SiteCheckoutContent | null>(() => this.payload()?.checkout ?? null);
  readonly orderConfirmation = computed<SiteOrderConfirmationContent | null>(() => this.payload()?.orderConfirmation ?? null);

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

  /**
   * A stored logo/media path if safe, resolved against the API origin so an
   * `<img>` binds a URL that actually exists (the API serves `/media/...` from
   * its own origin, see LocalMediaStorage). Unsafe values degrade to ''. */
  mediaUrl(url: string | null | undefined): string {
    return resolveMediaUrl(this.safeUrl(url));
  }

  externalLink(url: string | null | undefined): boolean {
    return /^https?:\/\//i.test((url ?? '').trim());
  }

  isRelative(url: string | null | undefined): boolean {
    const trimmed = (url ?? '').trim();
    return trimmed.startsWith('/') && !trimmed.startsWith('//');
  }

  /** Loads on startup and refreshes promptly on tab focus without request churn. */
  load(refresh = false): void {
    const now = Date.now();
    if (environment.useMockApi) {
      this.contentLoaded.set(true);
      return;
    }
    if (this.loaded && (!refresh || now - this.lastRequestAt < 2_000)) return;
    this.loaded = true;
    this.lastRequestAt = now;
    this.api
      .get<SiteContent>('site-content')
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (res && typeof res === 'object') this.payload.set(res);
        else this.loaded = false;
        this.contentLoaded.set(true);
      });
  }

  private static isSafeUrl(url: string): boolean {
    return (url.startsWith('/') && !url.startsWith('//')) || /^https?:\/\//i.test(url);
  }
}
