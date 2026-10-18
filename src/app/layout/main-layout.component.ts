import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { HeaderComponent } from './header.component';
import { FooterComponent } from './footer.component';
import { StorefrontConfigService } from '../core/services/storefront-config.service';
import { SiteContentService } from '../core/services/site-content.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Toast, ConfirmDialog, HeaderComponent, FooterComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent implements OnInit {
  protected storefront = inject(StorefrontConfigService);
  private siteContent = inject(SiteContentService);

  ngOnInit(): void {
    // Published storefront config (theme, feature flags, section order).
    // Safe no-op in mock mode and on failure: built-in defaults apply.
    this.storefront.load();
    // Employee-editable content (header, hero, categories, home sections, footer).
    this.siteContent.load();
  }
}
