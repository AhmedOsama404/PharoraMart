import { Injectable, effect } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { I18nService } from './i18n.service';

/**
 * Localized document titles. Routes declare `data: { titleKey: 'meta.cart' }`
 * and this strategy resolves the key against the active language — so titles
 * follow runtime language switching without a reload. Falls back to the
 * static route `title` (English) when no key is present.
 */
@Injectable({ providedIn: 'root' })
export class LocalizedTitleStrategy extends TitleStrategy {
  constructor(
    private title: Title,
    private i18n: I18nService,
  ) {
    super();
    // Re-apply the current route's title whenever the language changes,
    // since TitleStrategy otherwise only runs on navigation. Routes without
    // a titleKey (e.g. product details, which sets its own title) are left
    // alone so a language switch never clobbers them.
    effect(() => {
      this.i18n.currentLang();
      const snapshot = this.currentSnapshot;
      if (snapshot && this.titleKeyOf(snapshot)) this.updateTitle(snapshot);
    });
  }

  private currentSnapshot: RouterStateSnapshot | null = null;

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.currentSnapshot = snapshot;
    const key = this.titleKeyOf(snapshot);
    this.title.setTitle(key ? this.i18n.t(key) : (this.buildTitle(snapshot) ?? 'Pharora'));
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
