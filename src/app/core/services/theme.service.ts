import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { catchError, finalize, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiClientService } from '../api/api-client.service';
import { toTheme } from '../api/theme.mapper';
import { resolveMediaUrl } from '../../shared/utils/media-url.utils';
import { I18nService } from './i18n.service';
import type { StorefrontTheme } from '../../models/theme.model';
import type { LocalizedText } from '../../models/product.model';

/** Sentinel for a failed request (a `null` body is a different case). */
const LOAD_FAILED = Symbol('theme-load-failed');

/**
 * Storefront brand/theme. The backend is authoritative: a published theme
 * (rowVersion >= 1) recolors the whole storefront (CSS custom properties on
 * the document root), swaps the favicon, updates the theme-color and the
 * social-share image. Before anything is published the compiled `:root`
 * palette stays in place — it IS the built-in identity, identical to what the
 * backend serves as `DefaultTheme` with rowVersion 0.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly api = inject(ApiClientService);
  private readonly doc = inject(DOCUMENT);
  private readonly i18n = inject(I18nService);
  private readonly theme = signal<StorefrontTheme | null>(null);
  private readonly loaded = signal(false);
  readonly ready = this.loaded.asReadonly();
  private inFlight = false;
  private lastRequestAt = 0;

  /** True only when the backend published a real theme (rowVersion >= 1). */
  readonly published = computed(() => (this.theme()?.rowVersion ?? 0) >= 1);

  constructor() {
    // Localized SEO surfaces (meta description, og:title/description) follow
    // the language like the document title does; the palette itself does not.
    effect(() => {
      this.i18n.currentLang();
      const theme = this.theme();
      if (theme && this.published()) this.applyMeta(theme);
    });
  }

  /** Resolved logo URL, '' when the theme names none. */
  readonly logoUrl = computed(() => this.mediaUrl(this.theme()?.logoUrl));

  /** Resolved favicon URL, '' when the theme names none. */
  readonly faviconUrl = computed(() => this.mediaUrl(this.theme()?.faviconUrl));

  /** Resolved social-share image URL, '' when the theme names none. */
  readonly socialShareUrl = computed(() => this.mediaUrl(this.theme()?.socialShareUrl));

  /** Resolved promo image URL, '' when the theme names none. */
  readonly promoImageUrl = computed(() => this.mediaUrl(this.theme()?.promoImageUrl));

  /** The theme's own SEO title for the active language ('' when unset). */
  metaTitle(locale: string): string {
    return this.text(this.theme()?.metaTitle, locale);
  }

  /** Localized promo copy ('' when unset). */
  promoHeadline(locale: string): string {
    return this.text(this.theme()?.promoHeadline, locale);
  }

  promoBody(locale: string): string {
    return this.text(this.theme()?.promoBody, locale);
  }

  promoBadge(locale: string): string {
    return this.text(this.theme()?.promoBadge, locale);
  }

  promoCtaLabel(locale: string): string {
    return this.text(this.theme()?.promoCtaLabel, locale);
  }

  promoCtaUrl(): string {
    return this.safeUrl(this.theme()?.promoCtaUrl);
  }

  defaultPhoneCountry(): string {
    return this.theme()?.defaultPhoneCountry ?? '';
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

  private mediaUrl(url: string | undefined): string {
    return url ? resolveMediaUrl(url) : '';
  }

  private safeUrl(url: string | undefined): string {
    const trimmed = typeof url === 'string' ? url.trim() : '';
    return trimmed.startsWith('/') && !trimmed.startsWith('//') ? trimmed : '';
  }

  /** Loads on startup and refreshes promptly on tab focus, one request at a time. */
  load(refresh = false): void {
    const now = Date.now();
    if (environment.useMockApi) {
      this.loaded.set(true);
      return;
    }
    if (this.inFlight) return;
    if (this.loaded() && (!refresh || now - this.lastRequestAt < 2_000)) return;
    this.inFlight = true;
    this.lastRequestAt = now;
    this.api
      .get<unknown>('store/theme', undefined, { silent: true })
      .pipe(
        finalize(() => (this.inFlight = false)),
        catchError(() => of(LOAD_FAILED)),
      )
      .subscribe((res) => {
        if (res === LOAD_FAILED) {
          // Keep the compiled palette; a later refresh tries again.
          this.loaded.set(true);
          return;
        }
        const sanitized = toTheme(res);
        if (!sanitized) {
          this.loaded.set(true);
          return;
        }
        this.theme.set(sanitized);
        if (this.published()) this.applyPalette(sanitized);
        this.loaded.set(true);
      });
  }

  /**
   * Applies the language-independent identity: the color palette (every
   * base AND derived token — the compiled values are literals, not derived),
   * the font, the favicon, the theme-color and the social-share image.
   */
  private applyPalette(theme: StorefrontTheme): void {
    const style = this.doc.documentElement.style;
    const set = (prop: string, value: string): void => style.setProperty(prop, value);
    const p = theme.primaryColor;
    const s = theme.secondaryColor;
    const t = theme.textColor;
    set('--primary', p);
    set('--primary-hover', `color-mix(in srgb, ${p} 86%, black)`);
    set('--accent', theme.accentColor);
    set('--surface-ground', s);
    set('--surface-card', theme.surfaceColor);
    set('--surface-border', `color-mix(in srgb, ${s} 82%, #bfb69e)`);
    set('--text-primary', t);
    set('--text-secondary', `color-mix(in srgb, ${t} 62%, #ffffff)`);
    set('--brand-deep', `color-mix(in srgb, ${p} 52%, black)`);
    set('--brand-mid', `color-mix(in srgb, ${p} 70%, black)`);
    set('--brand-soft', `color-mix(in srgb, ${p} 84%, black)`);
    if (theme.fontFamily) {
      set(
        '--font-stack',
        `${theme.fontFamily}, 'Segoe UI', system-ui, -apple-system, 'Noto Kufi Arabic', 'Noto Sans Arabic', Tahoma, sans-serif`,
      );
    }
    this.setMeta('theme-color', p);
    const favicon = resolveMediaUrl(theme.faviconUrl);
    if (favicon) {
      let link = this.doc.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) {
        link = this.doc.createElement('link');
        link.rel = 'icon';
        this.doc.head.appendChild(link);
      }
      link.type = 'image/x-icon';
      link.href = favicon;
    }
    const share = resolveMediaUrl(theme.socialShareUrl);
    if (share) this.setMeta('og:image', share);
  }

  /** Applies the localized SEO surfaces for the active language. */
  private applyMeta(theme: StorefrontTheme): void {
    const lang = this.i18n.currentLang();
    const title = this.text(theme.metaTitle, lang);
    const description = this.text(theme.metaDescription, lang);
    if (description) this.setMeta('description', description);
    if (title) this.setMeta('og:title', title);
    if (description) this.setMeta('og:description', description);
  }

  private setMeta(key: string, content: string): void {
    let meta = this.doc.querySelector<HTMLMetaElement>(`meta[name="${key}"], meta[property="${key}"]`);
    if (!meta) {
      meta = this.doc.createElement('meta');
      if (key.startsWith('og:')) meta.setAttribute('property', key);
      else meta.setAttribute('name', key);
      this.doc.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  }
}
