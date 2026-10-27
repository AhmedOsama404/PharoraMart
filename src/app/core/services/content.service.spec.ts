import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ContentService } from './content.service';

/**
 * A CMS banner is stored as an API-relative media path. Bound raw from the
 * storefront origin it 404s and the image silently disappears, so the service
 * resolves it against the API origin before any component sees it.
 */
describe('ContentService', () => {
  let service: ContentService;
  let http: HttpTestingController;
  let mockApi: boolean;
  const origin = new URL(environment.apiBaseUrl).origin;

  beforeEach(() => {
    mockApi = environment.useMockApi;
    environment.useMockApi = false;
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ContentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    environment.useMockApi = mockApi;
    http.verify();
  });

  it('resolves a relative banner path against the API origin', (done) => {
    service.published().subscribe((blocks) => {
      expect(blocks[0].imageUrl).toBe(`${origin}/media/2026/01/banner.png`);
      done();
    });

    http.expectOne((request) => request.url.endsWith('/content')).flush([
      {
        key: 'summer',
        title: 'Summer',
        body: 'Body',
        imageUrl: '/media/2026/01/banner.png',
        linkUrl: '/products',
        sortOrder: 1,
        isPublished: true,
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ]);
  });

  it('leaves an absolute banner URL and an absent one alone', (done) => {
    service.published().subscribe((blocks) => {
      expect(blocks[0].imageUrl).toBe('https://cdn.example.com/b.jpg');
      expect(blocks[1].imageUrl).toBe('');
      done();
    });

    http.expectOne((request) => request.url.endsWith('/content')).flush([
      {
        key: 'a',
        title: 'A',
        body: '',
        imageUrl: 'https://cdn.example.com/b.jpg',
        linkUrl: null,
        sortOrder: 1,
        isPublished: true,
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        key: 'b',
        title: 'B',
        body: '',
        imageUrl: null,
        linkUrl: null,
        sortOrder: 2,
        isPublished: true,
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ]);
  });
});
