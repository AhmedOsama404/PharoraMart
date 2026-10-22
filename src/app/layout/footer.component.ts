import { SafeImageDirective } from '../shared/resilience/safe-image.directive';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';
import { BrandLogoComponent } from '../shared/components/brand-logo.component';
import { SiteContentService } from '../core/services/site-content.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SafeImageDirective, RouterLink, FormsModule, Select, BrandLogoComponent],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  protected i18n = inject(I18nService);
  protected currency = inject(CurrencyService);
  protected siteContent = inject(SiteContentService);
  protected currencyOptions = computed(() => this.currency.options().map((c) => ({ label: c.code, value: c.code })));

  // Employee-editable footer copy (empty until loaded / when cleared).
  protected footer = this.siteContent.footer;
  // The brand name comes from the CMS; the app name is the fallback so the
  // footer never shows an empty brand.
  protected brandName = computed(
    () => this.siteContent.text(this.siteContent.footer()?.brandName, this.i18n.currentLang()) || environment.appName,
  );
  // Vector mark is the fallback when the edited logo is missing/unreachable.
  protected logoFailed = signal(false);
  protected logoUrl = computed(() =>
    this.logoFailed() ? '' : this.siteContent.mediaUrl(this.siteContent.footer()?.logoUrl),
  );
  protected tagline = computed(() => this.siteContent.text(this.siteContent.footer()?.tagline, this.i18n.currentLang()));
  protected copyrightText = computed(() => this.siteContent.text(this.siteContent.footer()?.copyrightText, this.i18n.currentLang()));
  protected noticeText = computed(() => this.siteContent.text(this.siteContent.footer()?.noticeText, this.i18n.currentLang()));

  /**
   * Contact lines are plain icon + text content. An email address opens a
   * mailto: draft and the WhatsApp line opens a wa.me chat so the previous
   * click-to-contact behaviour survives the move to edited content.
   */
  protected contactHref(icon: string, text: string): string | null {
    const value = text.trim();
    if (!value) return null;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
    if (this.siteContent.icon(icon) === 'pi pi-whatsapp') {
      const digits = value.replace(/\D/g, '');
      return digits ? `https://wa.me/${digits}` : null;
    }
    return null;
  }

  protected onCurrency(code: string): void {
    this.currency.setCurrency(code);
  }

  /** A logo that fails to load falls back to the vector brand mark. */
  protected onLogoError(): void {
    this.logoFailed.set(true);
  }
}
