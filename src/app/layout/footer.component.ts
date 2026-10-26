import { SafeImageDirective } from '../shared/resilience/safe-image.directive';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';
import { ContactService } from '../core/services/contact.service';
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
  protected contact = inject(ContactService);
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
   * The contact rows the footer shows.
   *
   * The website content decides WHICH rows there are and their icons; the
   * store's own settings decide WHAT they say. That way the footer can
   * never publish a WhatsApp number or an email that differs from the one
   * the order flow actually uses — there is a single source of truth for
   * every channel the customer can reach the shop on.
   */
  protected readonly contactRows = computed(() => {
    const settings = this.contact.channels();
    const rows = (this.footer()?.contacts ?? []).map((row) => {
      const icon = this.siteContent.icon(row.icon);
      const text = this.siteContent.text(row.text, this.i18n.currentLang());
      if (icon === 'pi pi-whatsapp') return { icon, text: settings?.whatsappNumber || text };
      if (icon === 'pi pi-envelope') return { icon, text: settings?.supportEmail || text };
      if (icon === 'pi pi-clock') return { icon, text: settings?.businessHours || text };
      return { icon, text };
    });

    const published = rows.filter((row) => row.text.trim().length > 0);
    if (published.length) return published;

    // No contact rows in the content: publish the store's own channels, so
    // the customer always has a way to reach the shop.
    const fallback: { icon: string; text: string }[] = [];
    if (settings?.whatsappNumber) fallback.push({ icon: 'pi pi-whatsapp', text: settings.whatsappNumber });
    if (settings?.supportEmail) fallback.push({ icon: 'pi pi-envelope', text: settings.supportEmail });
    if (settings?.businessHours) fallback.push({ icon: 'pi pi-clock', text: settings.businessHours });
    return fallback;
  });

  /**
   * Where a contact row leads: an email address opens a mailto: draft and
   * the WhatsApp line opens a wa.me chat — always at the store's published
   * channel, never at a number typed into the content.
   */
  protected contactHref(icon: string, text: string): string | null {
    const settings = this.contact.channels();
    const value = text.trim();
    if (!value) return null;
    if (icon === 'pi pi-whatsapp') {
      const digits = (settings?.whatsappNumber || value).replace(/\D/g, '');
      return digits ? `https://wa.me/${digits}` : null;
    }
    if (icon === 'pi pi-envelope') {
      const email = settings?.supportEmail || value;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${email}` : null;
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
