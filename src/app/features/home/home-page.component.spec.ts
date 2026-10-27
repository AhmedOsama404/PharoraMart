import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { DeferBlockBehavior, DeferBlockState, type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { HomePageComponent } from './home-page.component';
import { ProductService } from '../../core/services/product.service';
import { SiteContentService } from '../../core/services/site-content.service';
import { ContentService } from '../../core/services/content.service';
import { NotificationService } from '../../core/services/notification.service';
import { MOCK_PRODUCTS } from '../../data-access/mock-data';
import { hermeticApi } from '../../../testing/hermetic-api';

const ARRIVALS = MOCK_PRODUCTS.slice(0, 8);

// The carousel styles are global and scoped to the `app-home-page` element, so
// the page must be mounted under its real selector rather than a TestBed div.
@Component({ standalone: true, imports: [HomePageComponent], template: '<app-home-page />' })
class HostComponent {}

// The New Arrivals carousel must land exactly on card boundaries (no
// scroll-then-resnap double motion), wrap at both ends in LTR and RTL, and
// keep its autoplay timer paused while a mouse is over it.

/* A browser delivers an IntersectionObserver's first callback on its own
   render step, which a mock clock cannot advance. The autoplay spec used to
   wait for that signal with two animation frames and then tick 5s, so it lost
   the race about one run in four and reported a dead carousel when the gate
   had simply never been opened. This wrapper keeps the real observer — lazy
   image recovery in SafeImage is untouched — and lets a spec hand over the
   one signal it needs, then mutes the browser so it cannot contradict the
   fixture mid-assertion. */
const NativeIntersectionObserver = globalThis.IntersectionObserver;

class IntersectionObserverControl {
  private static created: IntersectionObserverControl[] = [];
  private muted = false;
  disconnected = false;
  private readonly observed: Element[] = [];
  private readonly real: IntersectionObserver;

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.real = new NativeIntersectionObserver((entries, observer) => {
      if (this.muted) return;
      this.callback(entries, observer);
    }, options);
    IntersectionObserverControl.created.push(this);
  }

  static reset(): void {
    IntersectionObserverControl.created = [];
  }

  /** The observer watching `target`, whichever component registered it last. */
  static for(target: Element): IntersectionObserverControl {
    const match = [...IntersectionObserverControl.created].reverse().find((o) => o.observed.includes(target));
    if (!match) throw new Error('no IntersectionObserver is watching the arrivals track');
    return match;
  }

  emitEnter(): void {
    this.muted = true;
    this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }

  observe(target: Element): void {
    this.observed.push(target);
    this.real.observe(target);
  }

  unobserve(target: Element): void {
    this.real.unobserve(target);
  }

  disconnect(): void {
    this.disconnected = true;
    this.real.disconnect();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return this.real.takeRecords();
  }
}

describe('HomePageComponent (New Arrivals carousel)', () => {
  let fixture: ComponentFixture<HostComponent>;

  async function render(dir: 'ltr' | 'rtl' = 'ltr'): Promise<HTMLDivElement> {
    fixture = TestBed.createComponent(HostComponent);
    const host = fixture.nativeElement as HTMLElement;
    host.style.display = 'block';
    host.style.width = '900px';
    host.dir = dir;
    fixture.detectChanges();
    for (let pass = 0; pass < 3; pass++) {
      for (const block of await fixture.getDeferBlocks()) await block.render(DeferBlockState.Complete);
      fixture.detectChanges();
    }
    const track = host.querySelector<HTMLDivElement>('#new-arrivals-track');
    if (!track) throw new Error('arrivals track did not render');
    // Jump instead of animating so the landing position is observable at once.
    spyOn(track, 'scrollTo').and.callFake(((options: ScrollToOptions) => {
      track.scrollLeft = options.left ?? 0;
    }) as typeof track.scrollTo);
    return track;
  }

  function controls(): { prev: HTMLButtonElement; next: HTMLButtonElement } {
    const [prev, next] = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.arrivals-control'));
    return { prev, next };
  }

  /** Logical distance of each card's start edge from the scroll origin. */
  function cardStarts(track: HTMLDivElement): number[] {
    const rtl = getComputedStyle(track).direction === 'rtl';
    const first = track.children[0].getBoundingClientRect();
    return Array.from(track.children, (card) => {
      const rect = card.getBoundingClientRect();
      return Math.round(rtl ? first.right - rect.right : rect.left - first.left);
    });
  }

  const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  beforeEach(() => {
    localStorage.clear();
    IntersectionObserverControl.reset();
    globalThis.IntersectionObserver = IntersectionObserverControl as unknown as typeof IntersectionObserver;
    TestBed.configureTestingModule({
      deferBlockBehavior: DeferBlockBehavior.Manual,
      providers: [
        ...hermeticApi(),
        provideRouter([]),
        {
          provide: ProductService,
          useValue: {
            categories: () => of([]),
            featured: () => of([]),
            newArrivals: () => of(ARRIVALS),
            popular: () => of([]),
            getById: () => of(null),
            getByIds: () => of([]),
            getByIdsMany: () => of([]),
            categoryLabel: () => '',
            categoryDescription: () => '',
          },
        },
        { provide: ContentService, useValue: { published: () => of([]) } },
        { provide: NotificationService, useValue: { success: () => undefined, error: () => undefined, info: () => undefined } },
      ],
    });
  });

  afterEach(() => {
    fixture?.destroy();
    globalThis.IntersectionObserver = NativeIntersectionObserver;
  });

  for (const dir of ['ltr', 'rtl'] as const) {
    it(`steps card by card and wraps at both ends (${dir})`, async () => {
      const track = await render(dir);
      const sign = dir === 'rtl' ? -1 : 1;
      const starts = cardStarts(track);
      const max = track.scrollWidth - track.clientWidth;
      expect(max).toBeGreaterThan(starts[1]);
      const { prev, next } = controls();

      next.click();
      expect(Math.abs(track.scrollLeft)).toBeCloseTo(starts[1], -0.5);
      next.click();
      expect(Math.abs(track.scrollLeft)).toBeCloseTo(starts[2], -0.5);
      prev.click();
      expect(Math.abs(track.scrollLeft)).toBeCloseTo(starts[1], -0.5);

      track.scrollLeft = sign * max;
      next.click();
      expect(track.scrollLeft).toBe(0);
      prev.click();
      expect(Math.abs(track.scrollLeft)).toBeCloseTo(max, -0.5);
    });
  }

  /**
   * A second click that lands while the first animation is still easing must
   * still move a whole card. Deriving the step from the reported offset (rather
   * than the offset the scroll was commanded to) re-issued the target the track
   * was already heading for, so the click did nothing — the reported stutter.
   */
  it('steps from the commanded target when a click lands mid-animation', async () => {
    const track = await render();
    const starts = cardStarts(track);
    const { next } = controls();

    next.click();
    expect(Math.round(track.scrollLeft)).toBeCloseTo(starts[1], -0.5);

    // Early in the easing: 20% of the way from card 1 to card 2.
    track.scrollLeft = starts[1] * 0.2;
    next.click();
    expect(Math.round(track.scrollLeft)).toBeCloseTo(starts[2], -0.5);
  });

  it('autoplays only while not hovered, and stops when destroyed', async () => {
    jasmine.clock().install();
    try {
      const track = await render();
      // Let the render pass register the carousel's observer, then put the
      // track on screen for good.
      await nextFrame();
      const observer = IntersectionObserverControl.for(track);
      observer.emitEnter();
      const scrollTo = track.scrollTo as jasmine.Spy;
      const shell = track.parentElement!;

      jasmine.clock().tick(5_000);
      expect(scrollTo).toHaveBeenCalledTimes(1);

      shell.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
      jasmine.clock().tick(15_000);
      expect(scrollTo).toHaveBeenCalledTimes(1);

      shell.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
      jasmine.clock().tick(5_000);
      expect(scrollTo).toHaveBeenCalledTimes(2);

      fixture.destroy();
      jasmine.clock().tick(15_000);
      expect(scrollTo).toHaveBeenCalledTimes(2);
      // Destroying must take the observer down too: a detached callback would
      // keep reporting into a component that no longer exists.
      expect(observer.disconnected).toBeTrue();
    } finally {
      jasmine.clock().uninstall();
    }
  });
});

describe('HomePageComponent (hero products)', () => {
  const ids = [MOCK_PRODUCTS[0].id, MOCK_PRODUCTS[1].id];
  let hero = signal<{ productIds: (string | null)[] } | null>({ productIds: ids });
  let ready = signal(true);
  let heroRequest: Subject<(typeof MOCK_PRODUCTS)[number][]>;

  beforeEach(() => {
    localStorage.clear();
    hero = signal<{ productIds: (string | null)[] } | null>({ productIds: ids });
    ready = signal(true);
    heroRequest = new Subject<(typeof MOCK_PRODUCTS)[number][]>();
    TestBed.configureTestingModule({
      providers: [
        ...hermeticApi(),
        provideRouter([]),
        {
          provide: SiteContentService,
          useValue: {
            ready: ready.asReadonly(),
            hero: hero.asReadonly(),
            categoriesSection: signal(null).asReadonly(),
            homeSection: () => null,
            homeSectionVisible: () => true,
            text: (value: Record<string, string> | null | undefined, locale: string) =>
              value?.[locale] ?? value?.['en'] ?? '',
            icon: (_value: string, fallback = 'pi pi-tag') => fallback,
            safeUrl: () => '',
          },
        },
        {
          provide: ProductService,
          useValue: {
            categories: () => of([]),
            featured: () => of([]),
            newArrivals: () => of([]),
            popular: () => of([]),
            getById: () => of(null),
            getByIds: () => heroRequest.asObservable(),
            getByIdsMany: () => of([]),
            categoryLabel: () => '',
            categoryDescription: () => '',
          },
        },
        { provide: ContentService, useValue: { published: () => of([]) } },
        { provide: NotificationService, useValue: { success: () => undefined, error: () => undefined, info: () => undefined } },
      ],
    });
  });

  /**
   * A content refresh (an employee edit, or the tab-focus reload) re-runs the
   * hero effect while the by-ids request is still on the wire. The effect
   * returns early because the selection did not change — and the request must
   * survive that: cancelling it left `heroProductsLoading` true, so the hero
   * showed its skeleton until the page was reloaded.
   */
  it('finishes the hero request even when content refreshes mid-flight', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const page = fixture.debugElement.query(By.directive(HomePageComponent))
      .componentInstance as HomePageComponent & { heroProductsLoading: () => boolean };
    const host = fixture.nativeElement as HTMLElement;

    expect(page.heroProductsLoading()).toBeTrue();
    expect(host.querySelector('.hero-skeleton-copy')).not.toBeNull();

    hero.set({ productIds: ids });
    fixture.detectChanges();

    heroRequest.next(MOCK_PRODUCTS.slice(0, 2));
    heroRequest.complete();
    fixture.detectChanges();

    expect(page.heroProductsLoading()).toBeFalse();
    expect(host.querySelector('.hero-skeleton-copy')).toBeNull();
    expect(host.querySelector('.hero-card')).not.toBeNull();

    fixture.destroy();
  });
});
