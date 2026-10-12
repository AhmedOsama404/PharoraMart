import { TestBed } from '@angular/core/testing';
import { ScrollService } from './scroll.service';

describe('ScrollService', () => {
  let svc: ScrollService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(ScrollService);
  });

  it('resets every viewport scroller to the top without throwing', () => {
    document.documentElement.scrollTop = 57;
    document.body.scrollTop = 57;
    expect(() => svc.scrollToTop()).not.toThrow();
    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.body.scrollTop).toBe(0);
    expect(svc.currentY()).toBe(0);
  });

  it('scrolls an element into view without throwing', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    expect(() => svc.scrollIntoView(el)).not.toThrow();
    el.remove();
  });
});
