import { DOCUMENT } from '@angular/common';
import { LocalizedPipe } from '../shared/pipes/localized.pipe';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { LocalizedText } from '../models/product.model';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Badge } from 'primeng/badge';
import { Drawer } from 'primeng/drawer';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Menu } from 'primeng/menu';
import { Select } from 'primeng/select';
import type { MenuItem } from 'primeng/api';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';
import { I18nService } from '../core/services/i18n.service';
import { SUPPORTED_LANGS, type SupportedLang } from '../core/config/i18n.config';
import { CurrencyService } from '../core/services/currency.service';
import { handleImgError } from '../shared/utils/image-fallback.utils';
import { CartStore } from '../core/services/cart.store';
import { FavoritesStore } from '../core/services/favorites.store';
import { AuthService } from '../core/services/auth.service';
import { ProductService } from '../core/services/product.service';
import { BrandLogoComponent } from '../shared/components/brand-logo.component';
import { StorefrontConfigService } from '../core/services/storefront-config.service';
import { SiteContentService } from '../core/services/site-content.service';

@Component({
  selector: 'app-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, RouterLinkActive, FormsModule, Badge, Drawer,
    IconField, InputIcon, InputText, Menu, Select, BrandLogoComponent,
    LocalizedPipe,
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  private document = inject(DOCUMENT);
  protected i18n = inject(I18nService);
  protected currency = inject(CurrencyService);
  protected cart = inject(CartStore);
  protected favorites = inject(FavoritesStore);
  protected auth = inject(AuthService);
  private products = inject(ProductService);
  protected storefront = inject(StorefrontConfigService);
  protected siteContent = inject(SiteContentService);
  private router = inject(Router);

  // Employee-editable brand + announcement (empty until loaded / when cleared).
  protected brandName = computed(() => this.siteContent.text(this.siteContent.header()?.brandName, this.i18n.currentLang()));
  // Falls back to the vector mark if the edited logo is missing/unreachable, so
  // a dead upload never shows a broken-image icon in the header.
  protected logoFailed = signal(false);
  protected brandLogoUrl = computed(() =>
    this.logoFailed() ? '' : this.siteContent.mediaUrl(this.siteContent.header()?.logoUrl),
  );
  protected announcement = computed(() => {
    const header = this.siteContent.header();
    if (!header || header.announcementVisible === false) return '';
    return this.siteContent.text(header.announcementText, this.i18n.currentLang());
  });

  protected mobileOpen = signal(false);
  protected searchTerm = '';
  protected suggestions = signal<{ id: string; name: string; names?: LocalizedText; images: string[] }[]>([]);
  protected showSuggestions = signal(false);
  // Keystrokes funnel through here so only settled input hits the service.
  private search$ = new Subject<string>();

  protected langModel: SupportedLang = this.i18n.currentLang();
  protected currencyOptions = computed(() => this.currency.options().map((c) => ({ label: c.code, value: c.code })));

  // Memoized option lists: p-select must keep a stable array reference or it
  // resyncs every change-detection cycle (see product-detail root cause).
  // One option per supported language; labels come from the dictionaries so the
  // selector itself is fully translated. Generic key lookup keeps this working
  // when languages are added — no per-language branches to maintain.
  protected langOptions = computed(() =>
    SUPPORTED_LANGS.map((l) => ({ label: this.i18n.t(`language.${l}`), value: l })),
  );

  protected accountItems = computed<MenuItem[]>(() => [
    { label: this.i18n.t('nav.profile'), icon: 'pi pi-user', routerLink: '/auth/profile' },
    { label: this.i18n.t('nav.orders'), icon: 'pi pi-box', routerLink: '/orders' },
    { separator: true },
    { label: this.i18n.t('nav.logout'), icon: 'pi pi-sign-out', command: () => this.doLogout() },
  ]);

  constructor() {
    // Debounced live suggestions; switchMap drops stale keystrokes.
    this.search$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => (term.trim() ? this.products.suggestions(term) : of([]))),
      )
      .subscribe((items) => {
        this.suggestions.set(items);
        this.showSuggestions.set(this.searchTerm.trim().length > 0);
      });
  }

  protected onSearchInput(term: string): void {
    this.search$.next(term);
  }

  protected goSearch(): void {
    this.showSuggestions.set(false);
    this.router.navigate(['/products'], { queryParams: { q: this.searchTerm.trim() || null } });
  }

  protected clearSearch(): void {
    this.searchTerm = '';
    this.suggestions.set([]);
    this.showSuggestions.set(false);
    this.router.navigate(['/products'], { queryParams: {} });
  }

  protected closeSuggestions(): void {
    this.showSuggestions.set(false);
  }

  // Suggestion thumbnails share the two-stage recovery (fixed-size box).
  protected imgFallback(ev: Event, seed: string): void {
    handleImgError(ev, seed);
  }

  /** A logo that fails to load falls back to the vector brand mark. */
  protected onLogoError(): void {
    this.logoFailed.set(true);
  }

  protected onLang(lang: SupportedLang): void {
    this.langModel = lang;
    this.i18n.setLang(lang);
  }

  protected onCurrency(code: string): void {
    this.currency.setCurrency(code);
  }

  /**
   * PrimeNG positions body-appended menus in document coordinates. A sticky
   * header moves independently of those coordinates, so anchor these two
   * header menus to the trigger's live viewport position after they open.
   */
  protected alignHeaderSelect(kind: 'language' | 'currency'): void {
    const view = this.document.defaultView;
    const trigger = this.document.querySelector<HTMLElement>(
      kind === 'language' ? '.lang-select' : '.cur-select',
    );

    if (!view || !trigger) return;

    view.requestAnimationFrame(() => {
      const panel = Array.from(
        this.document.querySelectorAll<HTMLElement>('.header-select-panel.p-select-overlay'),
      ).find((candidate) => view.getComputedStyle(candidate).display !== 'none');
      if (!panel || !trigger.isConnected) return;

      const triggerRect = trigger.getBoundingClientRect();
      panel.style.position = 'fixed';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.minWidth = `${triggerRect.width}px`;

      const panelHeight = panel.getBoundingClientRect().height;
      const panelWidth = panel.getBoundingClientRect().width;
      const top = Math.min(
        triggerRect.bottom + 6,
        Math.max(8, view.innerHeight - panelHeight - 8),
      );
      const left = Math.max(
        8,
        Math.min(triggerRect.left, view.innerWidth - panelWidth - 8),
      );

      panel.style.top = `${top}px`;
      panel.style.left = `${left}px`;
    });
  }

  /** Relative URLs route in-app; absolute http(s) URLs open externally. */
  protected isRelative(url: string): boolean {
    const u = url.trim();
    return u.startsWith('/') && !u.startsWith('//');
  }

  protected doLogout(): void {
    this.auth.logout();
    this.mobileOpen.set(false);
    this.router.navigate(['/']);
  }
}
