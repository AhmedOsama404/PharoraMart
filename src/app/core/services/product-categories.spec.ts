import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProductService } from './product.service';
import { MOCK_CATEGORIES } from '../../data-access/mock-data';
import { environment } from '../../../environments/environment';

describe('ProductService categories', () => {
  let svc: ProductService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
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

  it('resolves names from the live API once loaded, never the bundled demo set', () => {
    const http = TestBed.inject(HttpTestingController);
    const original = environment.useMockApi;
    environment.useMockApi = false;
    try {
      let ids: string[] = [];
      svc.categories().subscribe((cats) => (ids = cats.map((c) => c.id)));
      http
        .expectOne((r) => r.url.endsWith('/categories'))
        .flush([
          {
            id: 'herbs',
            name: 'Herbs',
            names: { en: 'Herbal Remedies', ar: 'أعشاب' },
            description: 'Live description',
            descriptions: { en: 'Live description' },
            image: '',
            sortOrder: 1,
            isActive: true,
          },
          {
            id: 'new-cat',
            name: 'New category',
            names: { en: 'New category' },
            description: '',
            descriptions: null,
            image: '',
            sortOrder: 2,
            isActive: true,
          },
        ]);

      expect(ids).toEqual(['herbs', 'new-cat']);
      // A dashboard rename wins over the bundled demo entry ('Herbs').
      expect(svc.categoryName('herbs')).toBe('Herbal Remedies');
      // A category the dashboard just created resolves its real name, not its slug.
      expect(svc.categoryName('new-cat')).toBe('New category');
      expect(svc.categoryDescription(svc.categoryById('herbs')!)).toBe('Live description');
      http.verify();
    } finally {
      environment.useMockApi = original;
    }
  });
});
