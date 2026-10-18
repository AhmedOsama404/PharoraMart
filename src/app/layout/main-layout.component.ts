import { ChangeDetectionStrategy, Component, HostListener, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { HeaderComponent } from './header.component';
import { FooterComponent } from './footer.component';
import { StorefrontConfigService } from '../core/services/storefront-config.service';
import { SiteContentService } from '../core/services/site-content.service';
import { ScrollService } from '../core/services/scroll.service';

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
  private router = inject(Router);
  private scroll = inject(ScrollService);

  constructor() {
    let currentPath = this.pathOf(this.router.url);
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        const nextPath = this.pathOf(event.urlAfterRedirects);
        // Route changes start at the top, while catalog query-param updates
        // keep the user's working position as they search and filter.
        if (nextPath !== currentPath) this.scroll.scrollToTop();
        currentPath = nextPath;
      });
  }

  private pathOf(url: string): string {
    return url.split(/[?#]/, 1)[0] || '/';
  }

  ngOnInit(): void {
    // Published storefront config (theme, feature flags, section order).
    // Safe no-op in mock mode and on failure: built-in defaults apply.
    this.storefront.load();
    // Employee-editable content (header, hero, categories, home sections, footer).
    this.siteContent.load();
  }

  @HostListener('window:focus')
  @HostListener('document:visibilitychange')
  protected refreshPublishedContent(): void {
    // Tab switches within the same browser window do not reliably fire
    // window:focus. Refresh when this tab becomes visible so a CMS publish is
    // picked up immediately without requiring a full reload.
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    this.storefront.load(true);
    this.siteContent.load(true);
  }
}
