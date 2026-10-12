import { TestBed } from '@angular/core/testing';
import { ProductService } from './product.service';
import { MOCK_CATEGORIES } from '../../data-access/mock-data';

describe('ProductService categories', () => {
  let svc: ProductService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    svc = TestBed.inject(ProductService);
  });

  it('exposes the business categories (cosmetics, herbs) in dashboard order', (done) => {
    svc.categories().subscribe((cats) => {
      expect(cats.map((c) => c.id)).toEqual(['cosmetics', 'herbs']);
      expect(cats.every((c) => c.isActive)).toBeTrue();
      done();
    });
  });

  it('resolves localized category names with English fallback', (done) => {
    svc.categories().subscribe(() => {
      expect(svc.categoryName('herbs')).toBe('Herbs');
      expect(svc.categoryName('no-such-category')).toBe('no-such-category');
      expect(MOCK_CATEGORIES.every((c) => typeof c.names.en === 'string' && c.names.en.length > 0)).toBeTrue();
      done();
    });
  });

  it('keeps products pointing at stable category ids', () => {
    svc.all().subscribe((items) => {
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((p) => typeof p.categoryId === 'string' && p.categoryId.length > 0)).toBeTrue();
    });
  });
});
