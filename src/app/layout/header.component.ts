import { SafeImageDirective } from '../shared/resilience/safe-image.directive';
import { LocalizedPipe } from '../shared/pipes/localized.pipe';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { debounceTime, distinctUntilChanged, Subject, switchMap, of, catchError } from 'rxjs';
import { I18nService } from '../core/services/i18n.service';
import { SUPPORTED_LANGS, type SupportedLang } from '../core/config/i18n.config';
import { CurrencyService } from '../core/services/currency.service';
import { handleImgError } from '../shared/utils/image-fallback.utils';
import { CartStore } from '../core/services/cart.store';
import { FavoritesStore } from '../core/services/favorites.store';
import { AuthService } from '../core/services/auth.service';
import { ProductService } from '../core/services/product.service';
import { environment } from '../../environments/environment';
import { BrandLogoComponent } from '../shared/components/brand-logo.component';
import { StorefrontDefaultsService } from '../core/services/storefront-defaults.service';
import { SiteContentService } from '../core/services/site-content.service';

@Component({
  selector: 'app-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SafeImageDirective, 
    RouterLink, RouterLinkActive, FormsModule, Badge, Drawer,
    IconField, InputIcon, InputText, Menu, Select, BrandLogoComponent,
    LocalizedPipe,
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  protected i18n = inject(I18nService);
  protected currency = inject(CurrencyService);
  protected cart = inject(CartStore);
  protected favorites = inject(FavoritesStore);
  protected auth = inject(AuthService);
  private products = inject(ProductService);
  protected storefront = inject(StorefrontDefaultsService);
  protected siteContent = inject(SiteContentService);
  private router = inject(Router);

  // Employee-editable brand + announcement (empty until loaded / when cleared).
  // The brand name comes from the CMS; until it loads (or when it is left
  // empty) the storefront still shows a name — and the logo link always has
  // an accessible name.
  protected brandName = computed(
    () => this.siteContent.text(this.siteContent.header()?.brandName, this.i18n.currentLang()) || environment.appName,
  );
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
  /** True once the page is scrolled: the bar then gains a shadow and a hairline. */
  protected readonly scrolled = signal(false);
  protected searchTerm = '';
  protected suggestions = signal<{ id: string; name: string; names?: LocalizedText; images: string[] }[]>([]);
  protected showSuggestions = signal(false);
  /** -1 means "typing a free-text query"; Enter then searches instead of opening. */
  protected activeSuggestion = signal(-1);
  /** Sticky panels below the header offset from this element's real height. */
  private topbarEl = viewChild<ElementRef<HTMLElement>>('topbar');
  // Keystrokes funnel through here so only settled input hits the service.
  private search$ = new Subject<string>();

  protected langModel: SupportedLang = this.i18n.currentLang();
  protected currencyOptions = computed(() => this.currency.options().map((c) => ({ label: c.code, value: c.code })));

  // Memoized option lists: p-select must keep a stable array reference or it
  // resyncs every change-detection cycle (see product-detail root cause).
  // One option per supported language; labels come from the dictionaries so the
  // selector itself is fully translated. Sorting by the visible label keeps the
  // menu predictable in every locale.
  protected langOptions = computed(() =>
    SUPPORTED_LANGS.map((l) => ({ label: this.i18n.t(`language.${l}`), value: l })).sort((a, b) =>
      a.label.localeCompare(b.label, this.i18n.currentLang()),
    ),
  );

  protected accountItems = computed<MenuItem[]>(() => [
    { label: this.i18n.t('nav.profile'), icon: 'pi pi-user', routerLink: '/auth/profile' },
    { label: this.i18n.t('nav.orders'), icon: 'pi pi-box', routerLink: '/orders' },
    { separator: true },
    { label: this.i18n.t('nav.logout'), icon: 'pi pi-sign-out', command: () => this.doLogout() },
  ]);

  constructor() {
    // Debounced live suggestions; switchMap drops stale keystrokes and the
    // whole chain is torn down with the header.
    this.search$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) =>
          term.trim()
            ? this.products.suggestions(term).pipe(catchError(() => of([])))
            : of([]),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((items) => {
        this.suggestions.set(items);
        this.activeSuggestion.set(-1);
        this.showSuggestions.set(this.searchTerm.trim().length > 0);
      });

    // The bar earns a shadow once the page moves. Scroll fires every frame, so
    // it is observed outside Angular: only the flip of `scrolled` re-renders.
    const zone = inject(NgZone);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const onScroll = () => {
        const scrolled = window.scrollY > 8;
        if (scrolled !== this.scrolled()) this.scrolled.set(scrolled);
      };
      zone.runOutsideAngular(() => window.addEventListener('scroll', onScroll, { passive: true }));
      onScroll();
      destroyRef.onDestroy(() => window.removeEventListener('scroll', onScroll));

      // Sticky side rails (catalog filters, cart and checkout summaries) used to
      // hardcode `top: 7rem`. The bar is not 7rem: the announcement band comes
      // from the CMS, the language label and the brand name reflow per locale,
      // and the font can be scaled — so a guessed offset either tucked the rail
      // under the header or left a gap. Publishing the measured height lets the
      // offset track all three.
      const publishHeight = () => {
        const el = this.topbarEl()?.nativeElement;
        if (el) document.documentElement.style.setProperty('--rs-header-h', `${el.offsetHeight}px`);
      };
      publishHeight();
      let observer: ResizeObserver | undefined;
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(publishHeight);
        const el = this.topbarEl()?.nativeElement;
        if (el) observer.observe(el);
      }
      // The Arabic dropdown alignment in styles.scss shifts a panel by its own
      // trigger's width, so the width has to be known there. Publishing it lets
      // both triggers be content-sized in Arabic exactly as they are in English;
      // pinned to a worst-case box instead, the two labels sat half a trigger
      // apart. A locale change reflows the label and the observer re-publishes.
      const triggerVars: ReadonlyArray<readonly [string, string]> = [
        ['.lang-select', '--rs-rtl-lang-w'],
        ['.cur-select', '--rs-rtl-cur-w'],
      ];
      const publishTriggerWidths = () => {
        const bar = this.topbarEl()?.nativeElement;
        if (!bar) return;
        for (const [selector, variable] of triggerVars) {
          const width = bar.querySelector(selector)?.getBoundingClientRect().width ?? 0;
          // Both selects are hidden on a phone, where no panel can open: keep
          // the last real measurement rather than publishing a zero width.
          if (width > 0) document.documentElement.style.setProperty(variable, `${width}px`);
        }
      };
      publishTriggerWidths();
      let widthObserver: ResizeObserver | undefined;
      if (typeof ResizeObserver !== 'undefined') {
        widthObserver = new ResizeObserver(publishTriggerWidths);
        const bar = this.topbarEl()?.nativeElement;
        for (const [selector] of triggerVars) {
          const el = bar?.querySelector(selector);
          if (el) widthObserver.observe(el);
        }
      }
      destroyRef.onDestroy(() => {
        observer?.disconnect();
        widthObserver?.disconnect();
        document.documentElement.style.removeProperty('--rs-header-h');
        for (const [, variable] of triggerVars) document.documentElement.style.removeProperty(variable);
      });
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
    this.activeSuggestion.set(-1);
  }

  /** Arrow-key walk through the open suggestion list. */
  protected onSuggestionArrow(step: -1 | 1): void {
    const count = this.suggestions().length;
    if (!this.showSuggestions() || count === 0) return;
    const current = this.activeSuggestion();
    const next = (current + step + count) % count;
    this.activeSuggestion.set(next);
  }

  /** Enter opens the highlighted suggestion; with nothing highlighted it searches. */
  protected onSearchEnter(): void {
    const index = this.activeSuggestion();
    const pick = index >= 0 ? this.suggestions()[index] : undefined;
    if (!pick) {
      this.goSearch();
      return;
    }
    this.closeSuggestions();
    void this.router.navigate(['/products', pick.id]);
  }

  protected onSuggestionEscape(): void {
    this.closeSuggestions();
  }

  /**
   * Pointer clicks outside the field move focus, which is the reliable signal
   * that the list is no longer wanted — a document `click` listener would fight
   * the suggestion anchors themselves and cost a global listener per header.
   */
  protected onSearchFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && (event.currentTarget as HTMLElement).contains(next)) return;
    this.closeSuggestions();
  }

  // Suggestion thumbnails share the two-stage recovery (fixed-size box).
  protected imgFallback(ev: Event, seed: string): void {
    handleImgError(ev, seed);
  }

  /** A logo that fails to load falls back to the vector brand mark. */
  protected onLogoError(): void {
    this.logoFailed.set(true);
  }

  protected async onLang(lang: SupportedLang): Promise<void> {
    await this.i18n.setLang(lang);
    this.langModel = this.i18n.currentLang();
  }

  protected onCurrency(code: string): void {
    this.currency.setCurrency(code);
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
