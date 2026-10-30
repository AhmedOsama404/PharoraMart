import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, finalize, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiClientService } from '../api/api-client.service';
import { resolveMediaUrl } from '../../shared/utils/media-url.utils';
import { SUPPORTED_LANGS } from '../config/i18n.config';
import type { LocalizedText } from '../../models/product.model';
import type {
  SiteButton,
  SiteCategoriesSection,
  SiteCheckoutContent,
  SiteContent,
  SiteFooter,
  SiteFooterColumn,
  SiteFooterContact,
  SiteFooterLink,
  SiteHeader,
  SiteHero,
  SiteHighlight,
  SiteHomeSection,
  SiteHomeSections,
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

/** The icon the place-order button carries when the CMS names none. */
export const DEFAULT_PLACE_ORDER_ICON = 'pi pi-check-circle';

/** The visual tones the place-order button may use. */
export const PLACE_ORDER_TONES = ['primary', 'success', 'accent', 'contrast'] as const;

/** The tone used when the CMS names none (or names one we do not know). */
export const DEFAULT_PLACE_ORDER_TONE = 'primary';

export type HomeSectionKey = 'featured' | 'newArrivals' | 'popular';

/** Sentinel for a failed request (a `null` body is a different case). */
const LOAD_FAILED = Symbol('site-content-load-failed');

/** Why the content could not be shown (see SiteContentService.contentError). */
export type SiteContentError = '' | 'load-failed' | 'invalid-payload';

// --- Payload normalization -------------------------------------------------
// The CMS payload is written by employees, so every field is treated as
// untrusted input: a missing value, a wrong type or a null must never reach
// a template that dereferences it (`footer.contacts.length`, `icon()`,
// `text()`, `safeUrl()`, `mediaUrl()`).

/** A plain object (an array or a primitive is not). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A stored string, or '' for anything else (number, null, object). */
function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** A stored boolean, or the fallback when the field is missing/not a boolean. */
function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** A stored array, or [] when the field is missing/not an array. */
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** A known place-order tone, or the default one. */
function asPlaceOrderTone(value: unknown): string {
  const tone = asText(value).trim().toLowerCase();
  return (PLACE_ORDER_TONES as readonly string[]).includes(tone) ? tone : DEFAULT_PLACE_ORDER_TONE;
}

/** A localized value: every supported language is a string ('' when missing). */
function asLocalized(value: unknown): LocalizedText {
  const src = isPlainObject(value) ? value : {};
  const text: LocalizedText = { en: asText(src['en']) };
  for (const lang of SUPPORTED_LANGS) {
    if (lang === 'en') continue;
    const raw = src[lang];
    if (raw !== undefined) text[lang] = asText(raw);
  }
  return text;
}

function asButton(value: unknown): SiteButton | null {
  const src = isPlainObject(value) ? value : null;
  if (!src) return null;
  return {
    label: asLocalized(src['label']),
    icon: asText(src['icon']),
    url: asText(src['url']),
  };
}

function asHighlights(value: unknown): SiteHighlight[] {
  return asArray(value).map((item) => {
    const src = isPlainObject(item) ? item : {};
    return { icon: asText(src['icon']), text: asLocalized(src['text']) };
  });
}

/** Product ids of the hero slot; a non-string entry is an empty slot. */
function asProductIds(value: unknown): (string | null)[] {
  return asArray(value).map((id) => (typeof id === 'string' ? id : null));
}

function asHeader(value: unknown): SiteHeader | null {
  const src = isPlainObject(value) ? value : null;
  if (!src) return null;
  return {
    brandName: asLocalized(src['brandName']),
    logoUrl: asText(src['logoUrl']),
    announcementText: asLocalized(src['announcementText']),
    announcementVisible: asBoolean(src['announcementVisible'], true),
  };
}

function asHero(value: unknown): SiteHero | null {
  const src = isPlainObject(value) ? value : null;
  if (!src) return null;
  return {
    badge: asLocalized(src['badge']),
    headline: asLocalized(src['headline']),
    description: asLocalized(src['description']),
    primaryButton: asButton(src['primaryButton']),
    secondaryButton: asButton(src['secondaryButton']),
    highlights: asHighlights(src['highlights']),
    productIds: asProductIds(src['productIds']),
  };
}

function asCategoriesSection(value: unknown): SiteCategoriesSection | null {
  const src = isPlainObject(value) ? value : null;
  if (!src) return null;
  return {
    sectionTitle: asLocalized(src['sectionTitle']),
    sectionBody: asLocalized(src['sectionBody']),
  };
}

function asHomeSection(value: unknown): SiteHomeSection | null {
  const src = isPlainObject(value) ? value : null;
  if (!src) return null;
  return {
    title: asLocalized(src['title']),
    body: asLocalized(src['body']),
    isVisible: asBoolean(src['isVisible'], true),
    viewAllText: asLocalized(src['viewAllText']),
    viewAllUrl: asText(src['viewAllUrl']),
  };
}

function asHomeSections(value: unknown): SiteHomeSections {
  const src = isPlainObject(value) ? value : {};
  return {
    featured: asHomeSection(src['featured']),
    newArrivals: asHomeSection(src['newArrivals']),
    popular: asHomeSection(src['popular']),
  };
}

function asFooterContacts(value: unknown): SiteFooterContact[] {
  return asArray(value).map((item) => {
    const src = isPlainObject(item) ? item : {};
    return { icon: asText(src['icon']), text: asLocalized(src['text']) };
  });
}

function asFooterLinks(value: unknown): SiteFooterLink[] {
  return asArray(value).map((item) => {
    const src = isPlainObject(item) ? item : {};
    return { text: asLocalized(src['text']), url: asText(src['url']) };
  });
}

function asFooterColumns(value: unknown): SiteFooterColumn[] {
  return asArray(value).map((item) => {
    const src = isPlainObject(item) ? item : {};
    return { header: asLocalized(src['header']), links: asFooterLinks(src['links']) };
  });
}

function asFooter(value: unknown): SiteFooter | null {
  const src = isPlainObject(value) ? value : null;
  if (!src) return null;
  return {
    logoUrl: asText(src['logoUrl']),
    brandName: asLocalized(src['brandName']),
    tagline: asLocalized(src['tagline']),
    contacts: asFooterContacts(src['contacts']),
    columns: asFooterColumns(src['columns']),
    copyrightText: asLocalized(src['copyrightText']),
    noticeText: asLocalized(src['noticeText']),
  };
}

function asCheckout(value: unknown): SiteCheckoutContent | null {
  const src = isPlainObject(value) ? value : null;
  if (!src) return null;
  return {
    title: asLocalized(src['title']),
    subtitle: asLocalized(src['subtitle']),
    contactTitle: asLocalized(src['contactTitle']),
    addressTitle: asLocalized(src['addressTitle']),
    paymentTitle: asLocalized(src['paymentTitle']),
    paymentMethodTitle: asLocalized(src['paymentMethodTitle']),
    paymentMethodBody: asLocalized(src['paymentMethodBody']),
    reviewTitle: asLocalized(src['reviewTitle']),
    placeOrderLabel: asLocalized(src['placeOrderLabel']),
    backToCartLabel: asLocalized(src['backToCartLabel']),
    showCouponEntry: asBoolean(src['showCouponEntry'], true),
    contactSubtitle: asLocalized(src['contactSubtitle']),
    addressSubtitle: asLocalized(src['addressSubtitle']),
    paymentSubtitle: asLocalized(src['paymentSubtitle']),
    reviewSubtitle: asLocalized(src['reviewSubtitle']),
    placeOrderIcon: asText(src['placeOrderIcon']) || DEFAULT_PLACE_ORDER_ICON,
    placeOrderTone: asPlaceOrderTone(src['placeOrderTone']),
  };
}

function asOrderConfirmation(value: unknown): SiteOrderConfirmationContent | null {
  const src = isPlainObject(value) ? value : null;
  if (!src) return null;
  return {
    title: asLocalized(src['title']),
    subtitle: asLocalized(src['subtitle']),
    deliveryTitle: asLocalized(src['deliveryTitle']),
    nextStepsTitle: asLocalized(src['nextStepsTitle']),
    nextStepOne: asLocalized(src['nextStepOne']),
    nextStepTwo: asLocalized(src['nextStepTwo']),
    nextStepThree: asLocalized(src['nextStepThree']),
    whatsAppButtonLabel: asLocalized(src['whatsAppButtonLabel']),
    whatsAppHint: asLocalized(src['whatsAppHint']),
    emailButtonLabel: asLocalized(src['emailButtonLabel']),
    emailHint: asLocalized(src['emailHint']),
    continueShoppingLabel: asLocalized(src['continueShoppingLabel']),
    viewOrdersLabel: asLocalized(src['viewOrdersLabel']),
    showNextSteps: asBoolean(src['showNextSteps'], true),
    showWhatsAppButton: asBoolean(src['showWhatsAppButton'], true),
    showEmailButton: asBoolean(src['showEmailButton'], true),
    showDemoNotice: asBoolean(src['showDemoNotice'], true),
    contactTitle: asLocalized(src['contactTitle']),
    showContactDetails: asBoolean(src['showContactDetails'], true),
  };
}

/**
 * Normalizes the raw GET site-content body into the shape the templates
 * dereference. Returns null when the payload is not a plain object (an array
 * or a primitive) — such a payload is never stored.
 */
export function sanitizeSiteContent(raw: unknown): SiteContent | null {
  if (!isPlainObject(raw)) return null;
  return {
    header: asHeader(raw['header']),
    hero: asHero(raw['hero']),
    categoriesSection: asCategoriesSection(raw['categoriesSection']),
    homeSections: asHomeSections(raw['homeSections']),
    footer: asFooter(raw['footer']),
    checkout: asCheckout(raw['checkout']),
    orderConfirmation: asOrderConfirmation(raw['orderConfirmation']),
  };
}

/**
 * Employee-editable storefront content (header, hero, categories heading, the
 * three home product sections, footer). Loaded once per session; every getter
 * degrades to empty so a failed or absent payload never crashes the shop and
 * never resurrects hardcoded copy.
 *
 * The stored payload is always SANITIZED (see sanitizeSiteContent): a
 * malformed body can therefore never make a template dereference `null`.
 */
@Injectable({ providedIn: 'root' })
export class SiteContentService {
  private readonly api = inject(ApiClientService);
  private readonly payload = signal<SiteContent | null>(null);
  private loaded = false;
  /** True while the config GET is on the wire, so no second copy is queued. */
  private inFlight = false;
  private readonly contentLoaded = signal(false);
  readonly ready = this.contentLoaded.asReadonly();
  private readonly contentErrorState = signal<SiteContentError>('');
  /**
   * Why the content could not be shown: 'load-failed' (the request failed)
   * or 'invalid-payload' (the body was not a usable object). Empty while the
   * last load succeeded — a failed refresh keeps the previous content but
   * still reports the error.
   */
  readonly contentError = this.contentErrorState.asReadonly();
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
    if (!value || typeof value !== 'object') return '';
    const record = value as unknown as Record<string, unknown>;
    const pick = (key: string): string => {
      const raw = record[key];
      return typeof raw === 'string' ? raw.trim() : '';
    };
    return pick(locale) || pick('en');
  }

  /**
   * The store's brand name in the active language: the CMS header first, then
   * the footer, then the bundled app name — so the header, the footer and the
   * document title all read one name, and never an empty one.
   */
  brandName(locale: string): string {
    return (
      this.text(this.header()?.brandName, locale) ||
      this.text(this.footer()?.brandName, locale) ||
      environment.appName
    );
  }

  /** Allow-listed PrimeIcons class for a stored value, else the fallback. */
  icon(value: string | null | undefined, fallback: string = ICON_FALLBACK): string {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return ALLOWED_ICONS.has(trimmed) ? trimmed : fallback;
  }

  /** A stored link if it is an in-store path or an http(s) URL, else ''. */
  safeUrl(url: string | null | undefined): string {
    const trimmed = typeof url === 'string' ? url.trim() : '';
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
    return /^https?:\/\//i.test(typeof url === 'string' ? url.trim() : '');
  }

  isRelative(url: string | null | undefined): boolean {
    const trimmed = typeof url === 'string' ? url.trim() : '';
    return trimmed.startsWith('/') && !trimmed.startsWith('//');
  }

  /** Loads on startup and refreshes promptly on tab focus without request churn. */
  load(refresh = false): void {
    const now = Date.now();
    if (environment.useMockApi) {
      this.contentLoaded.set(true);
      return;
    }
    // One request at a time, even after a failure. Without this the startup
    // load, a tab-focus refresh and the recovery hook each queued their own
    // copy of the same GET against a slow backend — three sockets for one
    // answer, on an origin the browser only lets have six.
    if (this.inFlight) return;
    if (this.loaded && (!refresh || now - this.lastRequestAt < 2_000)) return;
    this.loaded = true;
    this.inFlight = true;
    this.lastRequestAt = now;
    this.api
      .get<unknown>('site-content')
      .pipe(
        // No retry layer here: ApiClientService already classifies transient
        // failures and retries a GET within one bounded budget. Retrying the
        // whole pipeline again turned 3 attempts into 9 and let a single stalled
        // config request occupy the connection pool for a minute.
        finalize(() => (this.inFlight = false)),
        catchError(() => of(LOAD_FAILED)),
      )
      .subscribe((res) => {
        if (res === LOAD_FAILED) {
          // The request failed: keep whatever is already stored and let a
          // later refresh try again.
          this.loaded = false;
          this.contentErrorState.set('load-failed');
          this.contentLoaded.set(true);
          return;
        }
        const sanitized = sanitizeSiteContent(res);
        if (!sanitized) {
          // An array or a primitive is never stored.
          this.loaded = false;
          this.contentErrorState.set('invalid-payload');
          this.contentLoaded.set(true);
          return;
        }
        this.payload.set(sanitized);
        this.contentErrorState.set('');
        this.contentLoaded.set(true);
      });
  }

  private static isSafeUrl(url: string): boolean {
    return (url.startsWith('/') && !url.startsWith('//')) || /^https?:\/\//i.test(url);
  }
}
