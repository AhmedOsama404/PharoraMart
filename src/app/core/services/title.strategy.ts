import { Injectable, effect } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { I18nService } from './i18n.service';
import { SiteContentService } from './site-content.service';
import { ThemeService } from './theme.service';

/**
 * Localized document titles. Routes declare `data: { titleKey: 'meta.cart' }`
 * and this strategy resolves the key against the active language, then
 * appends the store's live brand (CMS header/footer, else the bundled app
 * name). The home route uses the theme's own SEO title when the backend
 * published one, else the brand alone. Titles follow runtime language
 * switching, and the brand/theme loading, without a reload.
 */
@Injectable({ providedIn: 'root' })
export class LocalizedTitleStrategy extends TitleStrategy {
  constructor(
    private title: Title,
    private i18n: I18nService,
    private siteContent: SiteContentService,
    private theme: ThemeService,
  ) {
    super();
    // Re-apply the current route's title whenever the language, the CMS brand
    // or the theme (SEO title) settles, since TitleStrategy otherwise only
    // runs on navigation. Routes without a titleKey (e.g. product details,
    // which set their own title) are left alone so a language switch never
    // clobbers them.
    effect(() => {
      this.i18n.currentLang();
      this.siteContent.ready();
      this.theme.ready();
      const snapshot = this.currentSnapshot;
      if (snapshot && this.titleKeyOf(snapshot)) this.updateTitle(snapshot);
    });
  }

  private currentSnapshot: RouterStateSnapshot | null = null;

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.currentSnapshot = snapshot;
    const key = this.titleKeyOf(snapshot);
    const lang = this.i18n.currentLang();
    const brand = this.siteContent.brandName(lang);
    if (!key) {
      this.title.setTitle(this.buildTitle(snapshot) || brand);
      return;
    }
    if (key === 'meta.home') {
      this.title.setTitle(this.theme.metaTitle(lang) || brand);
      return;
    }
    const base = this.i18n.t(key);
    this.title.setTitle(base ? `${base} — ${brand}` : brand);
  }

  private titleKeyOf(snapshot: RouterStateSnapshot): string | null {
    let route = snapshot.root;
    let key: string | null = null;
    // Deepest child wins, like the default strategy's title resolution.
    while (route.firstChild) {
      route = route.firstChild;
      const candidate = route.data?.['titleKey'];
      if (typeof candidate === 'string') key = candidate;
    }
    return key;
  }
}
