import {
  Directive,
  DoCheck,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Renderer2,
} from '@angular/core';

export type SafeImageType =
  | 'product'
  | 'category'
  | 'banner'
  | 'avatar'
  | 'logo'
  | 'file'
  | 'generic';

/**
 * Universal image guard. Every `<img>` in the app carries `appSafeImg`, so a
 * null/empty/404/403/timeout/0x0/wrong-type image can never show the browser's
 * broken-image icon: the directive swaps in a bundled, typed SVG placeholder
 * (once — no error loops) and keeps the original box dimensions.
 *
 * A directive is used instead of a wrapper element so existing sizes, classes,
 * `srcset` and layout contracts stay intact; it is the single SafeImage
 * implementation for both apps.
 */
@Directive({
  selector: 'img[appSafeImg]',
  standalone: true,
  host: {
    '[attr.data-safe-image]': 'state',
  },
})
export class SafeImageDirective implements OnInit, DoCheck, OnDestroy {
  /** Placeholder family; defaults to a generic image. */
  @Input() appSafeImg: SafeImageType | '' = 'generic';
  /** Initials for avatar placeholders (e.g. "AO"). */
  @Input() safeImgInitials = '';

  state: 'loading' | 'loaded' | 'fallback' = 'loading';

  private failed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastSrc = '';

  constructor(
    private readonly el: ElementRef<HTMLImageElement>,
    private readonly renderer: Renderer2,
  ) {}

  ngOnInit(): void {
    const img = this.el.nativeElement;
    if (!img.getAttribute('loading') && img.getAttribute('fetchpriority') !== 'high') {
      this.renderer.setAttribute(img, 'loading', 'lazy');
    }
    if (!img.getAttribute('decoding')) {
      this.renderer.setAttribute(img, 'decoding', 'async');
    }
    const src = (img.getAttribute('src') ?? '').trim();
    this.lastSrc = src;
    if (!src || src === 'null' || src === 'undefined' || src === 'about:blank') {
      this.fallback();
      return;
    }
    // Guard slow/hung image hosts: after 15 s show the typed placeholder.
    this.timer = setTimeout(() => this.fallback(), 15_000);
  }

  /**
   * When a bound `src` changes (image previews), reset the once-guard so the
   * new URL gets a real chance instead of staying on the old placeholder.
   */
  ngDoCheck(): void {
    const src = (this.el.nativeElement.getAttribute('src') ?? '').trim();
    if (src === this.lastSrc) return;
    // Our own data URI must not count as a new source.
    if (src.startsWith('data:image/svg+xml')) {
      this.lastSrc = src;
      return;
    }
    this.lastSrc = src;
    this.failed = false;
    this.clearTimer();
    if (!src || src === 'null' || src === 'undefined' || src === 'about:blank') {
      this.fallback();
      return;
    }
    this.state = 'loading';
    this.timer = setTimeout(() => this.fallback(), 15_000);
  }

  @HostListener('load')
  onLoad(): void {
    if (this.failed) return;
    const img = this.el.nativeElement;
    // Some servers return 200 with an empty body; treat 0x0 as a failure.
    if (img.naturalWidth === 0 || img.naturalHeight === 0) {
      this.fallback();
      return;
    }
    this.clearTimer();
    this.state = 'loaded';
  }

  @HostListener('error')
  onError(): void {
    this.fallback();
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  private fallback(): void {
    if (this.failed) return;
    this.failed = true;
    this.clearTimer();
    const img = this.el.nativeElement;
    this.state = 'fallback';
    this.renderer.removeAttribute(img, 'srcset');
    const placeholder = placeholderDataUri(this.appSafeImg || 'generic', this.safeImgInitials);
    this.lastSrc = placeholder;
    this.renderer.setAttribute(img, 'src', placeholder);
    this.renderer.addClass(img, 'rs-safe-image');
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

const GLYPHS: Record<SafeImageType, string> = {
  product:
    '<path d="M30 34h40l6 12v28a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6V46z" fill="none" stroke="COLOR" stroke-width="4"/><path d="M24 46h52M42 34l8 12 8-12" fill="none" stroke="COLOR" stroke-width="4"/>',
  category:
    '<rect x="26" y="26" width="20" height="20" rx="4" fill="none" stroke="COLOR" stroke-width="4"/><rect x="54" y="26" width="20" height="20" rx="4" fill="none" stroke="COLOR" stroke-width="4"/><rect x="26" y="54" width="20" height="20" rx="4" fill="none" stroke="COLOR" stroke-width="4"/><rect x="54" y="54" width="20" height="20" rx="4" fill="none" stroke="COLOR" stroke-width="4"/>',
  banner:
    '<rect x="22" y="30" width="56" height="40" rx="6" fill="none" stroke="COLOR" stroke-width="4"/><circle cx="38" cy="45" r="5" fill="COLOR"/><path d="M25 65l14-14 10 10 8-8 12 12" fill="none" stroke="COLOR" stroke-width="4"/>',
  avatar:
    '<circle cx="50" cy="50" r="26" fill="none" stroke="COLOR" stroke-width="4"/><circle cx="50" cy="43" r="9" fill="none" stroke="COLOR" stroke-width="4"/><path d="M33 68c4-9 10-13 17-13s13 4 17 13" fill="none" stroke="COLOR" stroke-width="4"/>',
  logo:
    '<path d="M50 24l24 9v18c0 15-10 25-24 30-14-5-24-15-24-30V33z" fill="none" stroke="COLOR" stroke-width="4"/><path d="M50 38v18M41 47h18" stroke="COLOR" stroke-width="4"/>',
  file:
    '<path d="M34 24h24l12 12v40a4 4 0 0 1-4 4H34a4 4 0 0 1-4-4V28a4 4 0 0 1 4-4z" fill="none" stroke="COLOR" stroke-width="4"/><path d="M58 24v12h12M40 48h20M40 58h20M40 68h12" fill="none" stroke="COLOR" stroke-width="4"/>',
  generic:
    '<rect x="24" y="30" width="52" height="40" rx="6" fill="none" stroke="COLOR" stroke-width="4"/><circle cx="39" cy="45" r="5" fill="COLOR"/><path d="M27 66l14-14 10 10 8-8 12 12" fill="none" stroke="COLOR" stroke-width="4"/>',
};

function placeholderDataUri(type: SafeImageType, initials: string): string {
  const dark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('p-dark');
  const bg = dark ? '#1c2a22' : '#f1eee5';
  const fg = dark ? '#8fc4a6' : '#2e7d52';
  const glyph = (GLYPHS[type] ?? GLYPHS.generic).replace(/COLOR/g, fg);
  const text =
    type === 'avatar' && initials
      ? `<text x="50" y="58" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="700" fill="${fg}">${escapeXml(initials.slice(0, 2).toUpperCase())}</text>`
      : glyph;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" role="img"><rect width="100" height="100" fill="${bg}"/>${text}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(value: string): string {
  const entities: Record<string, string> = {
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  };
  return value.replace(/[<>&"']/g, (c) => entities[c] ?? c);
}
