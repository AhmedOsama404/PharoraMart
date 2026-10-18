import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import { StorefrontConfigService } from './storefront-config.service';

describe('StorefrontConfigService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  it('uses safe defaults (all sections visible, no announcements)', () => {
    const svc = TestBed.inject(StorefrontConfigService);
    expect(svc.announcements()).toEqual([]);
    expect(svc.headerLinks()).toEqual([]);
    expect(svc.isFeatureEnabled('anything-new')).toBeTrue();
    expect(svc.sectionOrder()).toContain('hero');
  });

  it('load() is a safe no-op in mock mode (no HTTP)', () => {
    const svc = TestBed.inject(StorefrontConfigService);
    expect(() => svc.load()).not.toThrow();
    expect(svc.announcements()).toEqual([]);
  });

  it('respects published section visibility and exact configured order', () => {
    const svc = TestBed.inject(StorefrontConfigService);
    const payload = (svc as unknown as { payload: WritableSignal<Record<string, unknown>> }).payload;
    payload.set({
      homepage: { sections: [
        { type: 'featured', visible: true, maxItems: 5, selectionMode: 'manual', productIds: ['rose-oil'] },
        { type: 'hero', visible: false },
        { type: 'popular', visible: true },
      ] },
    });

    expect(svc.sectionOrder()).toEqual(['featured', 'popular']);
    expect(svc.sectionSettings('featured')?.productIds).toEqual(['rose-oil']);
  });

  it('keeps an intentionally empty section list empty', () => {
    const svc = TestBed.inject(StorefrontConfigService);
    const payload = (svc as unknown as { payload: WritableSignal<Record<string, unknown>> }).payload;
    payload.set({ homepage: { sections: [] } });

    expect(svc.sectionOrder()).toEqual([]);
  });

  it('hides disabled custom header links without deleting their configuration', () => {
    const svc = TestBed.inject(StorefrontConfigService);
    const payload = (svc as unknown as { payload: WritableSignal<Record<string, unknown>> }).payload;
    payload.set({ navigation: {
      headerLinks: [{ label: 'Hidden header', url: '/header', visible: false }, { label: 'Shown header', url: '/shown' }],
    } });

    expect(svc.headerLinks().map((link) => link.label)).toEqual(['Shown header']);
  });
});
