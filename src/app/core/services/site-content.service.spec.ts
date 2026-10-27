import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { SiteContentService } from './site-content.service';

/**
 * The site content is written by employees, so the payload is untrusted: a
 * missing value, a wrong type or a null must never reach a template that
 * dereferences it (`footer.contacts.length`, `icon()`, `text()`, `safeUrl()`,
 * `mediaUrl()`).
 */
describe('SiteContentService', () => {
  let service: SiteContentService;
  let http: HttpTestingController;
  let mockApi: boolean;

  beforeEach(() => {
    // The unit suite runs in mock mode (no backend); the live load path is
    // exercised here, so it is enabled for this spec only.
    mockApi = environment.useMockApi;
    environment.useMockApi = false;
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SiteContentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    environment.useMockApi = mockApi;
    http.verify();
  });

  function flushSiteContent(body: unknown): void {
    service.load();
    http.expectOne((r) => r.url.endsWith('/site-content')).flush(body as object);
  }

  it('sanitizes a malformed payload instead of letting the templates crash', () => {
    flushSiteContent({
      header: { brandName: { en: 'Pharora', ar: 42 }, logoUrl: 7, announcementVisible: 'yes' },
      hero: {
        headline: { en: 'Hello', ar: null },
        highlights: null,
        primaryButton: { label: { en: 'Shop now' }, icon: 12, url: null },
        productIds: ['p1', 5, null],
      },
      footer: {
        logoUrl: {},
        contacts: null,
        columns: [{ header: { en: 'Help' }, links: null }],
      },
      homeSections: {
        featured: { title: { en: 'Featured' }, isVisible: false },
        newArrivals: 'not-an-object',
      },
      checkout: { title: { en: 'Checkout' }, showCouponEntry: false },
      orderConfirmation: { title: { en: 'Thanks' }, showWhatsAppButton: false },
      categoriesSection: { sectionTitle: { en: 'Categories' } },
    });

    // Arrays are always arrays.
    expect(service.footer()?.contacts).toEqual([]);
    expect(service.footer()?.columns.length).toBe(1);
    expect(service.footer()?.columns[0].links).toEqual([]);
    expect(service.hero()?.highlights).toEqual([]);

    // Strings are always strings.
    expect(service.footer()?.logoUrl).toBe('');
    expect(service.header()?.logoUrl).toBe('');
    expect(service.hero()?.primaryButton?.icon).toBe('');
    expect(service.hero()?.primaryButton?.url).toBe('');
    // A non-string translation becomes '' (the reader then falls back to English).
    expect(service.hero()?.headline.ar).toBe('');
    expect(service.header()?.brandName.ar).toBe('');
    expect(service.text(service.hero()?.headline, 'en')).toBe('Hello');
    expect(service.text(service.hero()?.primaryButton?.label, 'en')).toBe('Shop now');

    // Sections are objects or null.
    expect(service.homeSection('newArrivals')).toBeNull();
    expect(service.homeSection('featured')?.isVisible).toBeFalse();
    expect(service.homeSectionVisible('featured')).toBeFalse();
    expect(service.checkout()?.showCouponEntry).toBeFalse();
    expect(service.orderConfirmation()?.showWhatsAppButton).toBeFalse();

    // The template dereferences never throw.
    expect(() => service.footer()?.contacts.length).not.toThrow();
    expect(() => service.footer()?.columns[0].links.length).not.toThrow();
    expect(() => service.hero()?.highlights.length).not.toThrow();
    expect(() => service.icon(service.hero()?.primaryButton?.icon)).not.toThrow();
    expect(() => service.safeUrl(service.footer()?.columns[0].links[0]?.url)).not.toThrow();
    expect(() => service.mediaUrl(service.header()?.logoUrl)).not.toThrow();
    expect(() => service.text(service.hero()?.headline, 'en')).not.toThrow();
  });

  it('never stores an array payload', () => {
    flushSiteContent([{ header: { brandName: { en: 'Pharora' } } }]);

    expect(service.header()).toBeNull();
    expect(service.footer()).toBeNull();
    expect(service.hero()).toBeNull();
    expect(service.contentError()).toBe('invalid-payload');
  });

  it('never stores a primitive payload', () => {
    flushSiteContent('not-content');

    expect(service.header()).toBeNull();
    expect(service.contentError()).toBe('invalid-payload');
  });

  it('reports a failed load through contentError', () => {
    service.load();
    http
      .expectOne((r) => r.url.endsWith('/site-content'))
      .flush('nope', { status: 400, statusText: 'Bad Request' });

    expect(service.contentError()).toBe('load-failed');
    expect(service.footer()).toBeNull();
  });

  it('keeps a well-formed payload and clears the error', () => {
    flushSiteContent({
      footer: {
        brandName: { en: 'Pharora' },
        contacts: [{ icon: 'pi pi-phone', text: { en: '+20 100 123 4567' } }],
        columns: [{ header: { en: 'Help' }, links: [{ text: { en: 'FAQ' }, url: '/faq' }] }],
      },
      hero: { headline: { en: 'Hello' }, highlights: [{ icon: 'pi pi-truck', text: { en: 'Fast' } }] },
    });

    expect(service.contentError()).toBe('');
    expect(service.footer()?.contacts.length).toBe(1);
    expect(service.footer()?.contacts[0].icon).toBe('pi pi-phone');
    expect(service.text(service.footer()?.contacts[0].text, 'en')).toBe('+20 100 123 4567');
    expect(service.footer()?.columns[0].links[0].url).toBe('/faq');
    expect(service.hero()?.highlights.length).toBe(1);
  });
});
