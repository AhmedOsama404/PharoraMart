import { ChangeDetectionStrategy, Component, HostListener, NgZone, OnInit, inject } from '@angular/core';
import { NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { HeaderComponent } from './header.component';
import { FooterComponent } from './footer.component';
import { ConnectionBannerComponent } from '../shared/resilience/connection-banner.component';
import { SiteContentService } from '../core/services/site-content.service';
import { ContactService } from '../core/services/contact.service';
import { ScrollService } from '../core/services/scroll.service';
import { I18nService } from '../core/services/i18n.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Toast, ConfirmDialog, HeaderComponent, FooterComponent, ConnectionBannerComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent implements OnInit {
  protected i18n = inject(I18nService);
  private siteContent = inject(SiteContentService);
  private contact = inject(ContactService);
  private router = inject(Router);
  private scroll = inject(ScrollService);
  private zone = inject(NgZone);
  /** Viewport offset per history entry (keyed by router navigation id). */
  private readonly savedScroll = new Map<number, number>();
  private cancelRestore: (() => void) | null = null;
  private lastRefreshAt = 0;

  constructor() {
    // The router restores nothing (see ScrollService), so the browser must not
    // either: its native restore fires before the new view renders and jumps.
    if (typeof history !== 'undefined' && 'scrollRestoration' in history) history.scrollRestoration = 'manual';
    let currentPath = this.pathOf(this.router.url);
    let currentId = 0;
    let restoreTo: number | null = null;
    this.router.events
      .pipe(
        filter((event): event is NavigationStart | NavigationEnd =>
          event instanceof NavigationStart || event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          this.savedScroll.set(currentId, this.scroll.currentY());
          const restored = event.navigationTrigger === 'popstate' ? event.restoredState?.navigationId : undefined;
          restoreTo = restored === undefined ? null : this.savedScroll.get(restored) ?? null;
          return;
        }
        currentId = event.id;
        const nextPath = this.pathOf(event.urlAfterRedirects);
        // Back/forward returns the visitor to where they were on that entry;
        // a fresh route starts at the top, while catalog query-param updates
        // keep the user's working position as they search and filter.
        if (restoreTo !== null) this.restoreScroll(restoreTo);
        else if (nextPath !== currentPath) this.scroll.scrollToTop();
        currentPath = nextPath;
      });
  }

  /**
   * Restored pages usually re-fetch their data, so the saved offset may not
   * exist yet: wait (briefly) until the document is tall enough, and give up
   * the moment the visitor scrolls on their own.
   */
  private restoreScroll(y: number): void {
    this.cancelRestore?.();
    if (typeof window === 'undefined') return;
    if (y <= 0) {
      this.scroll.scrollToTop();
      return;
    }
    this.zone.runOutsideAngular(() => {
      const deadline = performance.now() + 2500;
      let frame = 0;
      const stop = () => {
        cancelAnimationFrame(frame);
        for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown']) window.removeEventListener(type, stop);
        if (this.cancelRestore === stop) this.cancelRestore = null;
      };
      const attempt = () => {
        const reachable = document.documentElement.scrollHeight - window.innerHeight;
        if (reachable >= y - 1) {
          window.scrollTo({ top: y, left: 0, behavior: 'instant' });
          stop();
        } else if (performance.now() > deadline) {
          stop();
        } else {
          frame = requestAnimationFrame(attempt);
        }
      };
      for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown']) window.addEventListener(type, stop, { passive: true });
      this.cancelRestore = stop;
      frame = requestAnimationFrame(attempt);
    });
  }

  private pathOf(url: string): string {
    return url.split(/[?#]/, 1)[0] || '/';
  }

  ngOnInit(): void {
    // Employee-editable content (header, hero, categories, home sections, footer).
    this.siteContent.load();
    // Admin-managed contact details (WhatsApp number, support email, business
    // hours, contact mode). Started here — next to the content load — so the
    // checkout already knows how the store wants to be contacted. The bundled
    // environment values stay in place until (and unless) the API answers.
    this.contact.load();
    this.lastRefreshAt = Date.now();
  }

  @HostListener('window:focus')
  @HostListener('document:visibilitychange')
  protected refreshPublishedContent(): void {
    // Tab switches within the same browser window do not reliably fire
    // window:focus. Refresh when this tab becomes visible so a CMS publish is
    // picked up immediately without requiring a full reload.
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    // Returning to the tab fires both focus and visibilitychange; one refresh
    // is enough.
    const now = Date.now();
    if (now - this.lastRefreshAt < 2_000) return;
    this.lastRefreshAt = now;
    this.siteContent.load(true);
    // The store's contact channels move too: the WhatsApp number, the support
    // email and the business hours are admin-managed, and a customer must
    // never be handed an out-of-date channel.
    this.contact.refresh();
  }
}
