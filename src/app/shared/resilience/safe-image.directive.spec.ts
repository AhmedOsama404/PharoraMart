import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SafeImageDirective, SafeImageType } from './safe-image.directive';

@Component({
  standalone: true,
  imports: [SafeImageDirective],
  template: `<img
    [appSafeImg]="type"
    [safeImgInitials]="initials"
    [src]="src"
    alt="Product photo"
  />`,
})
class HostComponent {
  src = 'https://cdn.example.test/p.jpg';
  type: SafeImageType = 'product';
  initials = '';
}

function make(): { fixture: ComponentFixture<HostComponent>; img: HTMLImageElement } {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const img = fixture.debugElement.query(By.css('img')).nativeElement as HTMLImageElement;
  return { fixture, img };
}

function markLoaded(img: HTMLImageElement, width = 320, height = 240): void {
  Object.defineProperty(img, 'naturalWidth', { configurable: true, value: width });
  Object.defineProperty(img, 'naturalHeight', { configurable: true, value: height });
  img.dispatchEvent(new Event('load'));
}

describe('SafeImageDirective', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  });

  it('replaces an empty source with a typed placeholder and keeps the alt text', () => {
    const { fixture, img } = make();
    fixture.componentInstance.src = '';
    fixture.detectChanges();

    expect(img.getAttribute('src') ?? '').toContain('data:image/svg+xml');
    expect(fixture.debugElement.query(By.directive(SafeImageDirective))).toBeTruthy();
    expect(img.getAttribute('alt')).toBe('Product photo');
    expect(img.getAttribute('data-safe-image')).toBe('fallback');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
  });

  it('replaces a failed image exactly once (no error loop)', () => {
    const { fixture, img } = make();

    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    const placeholder = img.getAttribute('src');
    expect(placeholder ?? '').toContain('data:image/svg+xml');
    expect(img.getAttribute('data-safe-image')).toBe('fallback');
    expect(img.classList.contains('rs-safe-image')).toBe(true);

    img.dispatchEvent(new Event('error'));
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(img.getAttribute('src')).toBe(placeholder);
  });

  it('treats a 200 with a zero-sized body as a failure', () => {
    const { fixture, img } = make();
    markLoaded(img, 0, 0);
    fixture.detectChanges();
    expect(img.getAttribute('data-safe-image')).toBe('fallback');
  });

  it('keeps a successful image untouched', () => {
    const { fixture, img } = make();
    const original = img.getAttribute('src');
    markLoaded(img);
    fixture.detectChanges();
    expect(img.getAttribute('data-safe-image')).toBe('loaded');
    expect(img.getAttribute('src')).toBe(original);
    expect(img.classList.contains('rs-safe-image')).toBe(false);
  });

  it('gives a new bound source a fresh chance after a failure', () => {
    const { fixture, img } = make();
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(img.getAttribute('data-safe-image')).toBe('fallback');

    fixture.componentInstance.src = 'https://cdn.example.test/new.jpg';
    fixture.detectChanges();
    fixture.detectChanges();
    expect(img.getAttribute('data-safe-image')).toBe('loading');
    expect(img.getAttribute('src')).toBe('https://cdn.example.test/new.jpg');

    markLoaded(img);
    fixture.detectChanges();
    expect(img.getAttribute('data-safe-image')).toBe('loaded');
  });

  it('renders escaped initials in an avatar placeholder', () => {
    const { fixture, img } = make();
    fixture.componentInstance.type = 'avatar';
    fixture.componentInstance.initials = 'a<o';
    fixture.componentInstance.src = '';
    fixture.detectChanges();

    const decoded = decodeURIComponent(img.getAttribute('src') ?? '');
    expect(decoded).toContain('>A&lt;</text>');
    expect(decoded).not.toContain('>A<<');
  });
});
