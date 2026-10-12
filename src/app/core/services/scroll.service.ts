import { Injectable } from '@angular/core';

/**
 * Centralized scroll strategy (the app configures NO router-level
 * scrollPositionRestoration on purpose: catalog filter/search changes push
 * query-param navigations on every keystroke, and router restoration would
 * yank the viewport to the top while the user is still typing).
 *
 * Rules:
 * - Same-component product navigation (related products, back/forward between
 *   products): jump to top instantly — the page content is about to be
 *   replaced by a skeleton anyway, so smooth scrolling would only smear.
 * - Fresh detail pages (checkout, confirmation, order details): top on init,
 *   otherwise users land mid-page carried over from the previous view.
 * - Catalog pagination: smooth scroll, the result list genuinely moved.
 * - Filter/sidebar interactions: no scroll — the user stays where they work.
 */
@Injectable({ providedIn: 'root' })
export class ScrollService {
  scrollToTop(behavior: ScrollBehavior = 'auto'): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const body = document.body;
    // `window.scrollTo` alone is unreliable when the document element rather
    // than the window owns the scroll offset, so reset every scroller.
    try {
      window.scrollTo({ top: 0, left: 0, behavior });
      root?.scrollTo?.({ top: 0, left: 0, behavior });
      body?.scrollTo?.({ top: 0, left: 0, behavior });
      if (root) root.scrollTop = 0;
      if (body) body.scrollTop = 0;
    } catch {
      // Scrolling must never break navigation (older/embedded browsers).
    }
  }

  scrollIntoView(el: HTMLElement): void {
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      /* ignore */
    }
  }

  currentY(): number {
    if (typeof window === 'undefined') return 0;
    return window.scrollY || document?.documentElement?.scrollTop || 0;
  }
}
