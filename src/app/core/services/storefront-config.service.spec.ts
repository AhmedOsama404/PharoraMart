import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { StorefrontConfigService } from './storefront-config.service';

describe('StorefrontConfigService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  it('uses safe defaults (all sections visible, no announcements)', () => {
    const svc = TestBed.inject(StorefrontConfigService);
    expect(svc.announcements()).toEqual([]);
    expect(svc.footerLinks()).toEqual([]);
    expect(svc.headerLinks()).toEqual([]);
    expect(svc.showSection('hero')).toBeTrue();
    expect(svc.isFeatureEnabled('anything-new')).toBeTrue();
    expect(svc.brandName('Pharora')).toBe('Pharora');
    expect(svc.sectionOrder()).toContain('hero');
  });

  it('load() is a safe no-op in mock mode (no HTTP)', () => {
    const svc = TestBed.inject(StorefrontConfigService);
    expect(() => svc.load()).not.toThrow();
    expect(svc.announcements()).toEqual([]);
  });
});
