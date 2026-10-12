import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
import { CurrencyService, CURRENCIES } from '../core/services/currency.service';
import { handleImgError } from '../shared/utils/image-fallback.utils';
import { CartStore } from '../core/services/cart.store';
import { FavoritesStore } from '../core/services/favorites.store';
import { AuthService } from '../core/services/auth.service';
import { ProductService } from '../core/services/product.service';
import { BrandLogoComponent } from '../shared/components/brand-logo.component';

@Component({
  selector: 'app-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, RouterLinkActive, FormsModule, Badge, Drawer,
    IconField, InputIcon, InputText, Menu, Select, BrandLogoComponent,
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
  private router = inject(Router);

  protected mobileOpen = signal(false);
  protected searchTerm = '';
  protected suggestions = signal<{ id: string; name: string; images: string[] }[]>([]);
  protected showSuggestions = signal(false);
  // Keystrokes funnel through here so only settled input hits the service.
  private search$ = new Subject<string>();

  protected langModel: SupportedLang = this.i18n.currentLang();
  protected currencyModel: string = this.currency.code();
  protected currencyOptions = CURRENCIES.map((c) => ({ label: c.code, value: c.code }));

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

  protected onLang(lang: SupportedLang): void {
    this.langModel = lang;
    this.i18n.setLang(lang);
  }

  protected onCurrency(code: string): void {
    this.currencyModel = code;
    this.currency.setCurrency(code);
  }

  protected doLogout(): void {
    this.auth.logout();
    this.mobileOpen.set(false);
    this.router.navigate(['/']);
  }
}
