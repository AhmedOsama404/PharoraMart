import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { LibreTranslateService } from './libre-translate.service';
import { environment } from '../../../environments/environment';

describe('LibreTranslateService', () => {
  let service: LibreTranslateService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.libreTranslateUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [LibreTranslateService],
    });
    service = TestBed.inject(LibreTranslateService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getLanguages', () => {
    it('should return supported languages', () => {
      const mockLanguages = [
        { code: 'en', name: 'English' },
        { code: 'ar', name: 'العربية' },
        { code: 'de', name: 'Deutsch' },
      ];

      service.getLanguages().subscribe((langs) => {
        expect(langs).toEqual(mockLanguages);
      });

      const req = httpMock.expectOne(`${baseUrl}/languages`);
      expect(req.request.method).toBe('GET');
      req.flush(mockLanguages);
    });

    it('should fallback to built-in languages on error', () => {
      service.getLanguages().subscribe((langs) => {
        expect(langs.length).toBeGreaterThan(0);
        expect(langs.some((l) => l.code === 'en')).toBeTrue();
      });

      const req = httpMock.expectOne(`${baseUrl}/languages`);
      req.error(new ErrorEvent('Network error'));
    });
  });

  describe('translate', () => {
    it('should translate text to target language', () => {
      const text = 'Hello world';
      const target = 'ar';
      const translated = 'مرحبا بالعالم';

      service.translate(text, target).subscribe((result) => {
        expect(result).toBe(translated);
      });

      const req = httpMock.expectOne(`${baseUrl}/translate`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        q: text,
        source: 'en',
        target,
        format: 'text',
      });
      req.flush({ translatedText: translated });
    });

    it('should return empty string for empty input', () => {
      service.translate('', 'ar').subscribe((result) => {
        expect(result).toBe('');
      });
      httpMock.expectNone(`${baseUrl}/translate`);
    });

    it('should fallback to original text on translation error', () => {
      const text = 'Hello world';

      service.translate(text, 'ar').subscribe((result) => {
        expect(result).toBe(text);
      });

      const req = httpMock.expectOne(`${baseUrl}/translate`);
      req.error(new ErrorEvent('Server error'));
    });

    it('should use custom source language when provided', () => {
      service.translate('Hallo', 'en', 'de').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/translate`);
      expect(req.request.body.source).toBe('de');
    });
  });

  describe('translateBatch', () => {
    it('should translate multiple texts', () => {
      const texts = ['Hello', 'Goodbye'];
      const target = 'ar';
      const results = ['مرحبا', 'وداعا'];

      service.translateBatch(texts, target).subscribe((translated) => {
        expect(translated).toEqual(results);
      });

      const req = httpMock.expectOne(`${baseUrl}/translate`);
      expect(req.request.body.q).toEqual(texts);
      req.flush(results.map((t) => ({ translatedText: t })));
    });

    it('should return empty array for empty input', () => {
      service.translateBatch([], 'ar').subscribe((result) => {
        expect(result).toEqual([]);
      });
      httpMock.expectNone(`${baseUrl}/translate`);
    });
  });

  describe('detect', () => {
    it('should detect language', () => {
      service.detect('مرحبا بالعالم').subscribe((lang) => {
        expect(lang).toBe('ar');
      });

      const req = httpMock.expectOne(`${baseUrl}/detect`);
      req.flush({ language: 'ar', confidence: 0.99 });
    });

    it('should fallback to en on error', () => {
      service.detect('text').subscribe((lang) => {
        expect(lang).toBe('en');
      });

      const req = httpMock.expectOne(`${baseUrl}/detect`);
      req.error(new ErrorEvent('Error'));
    });
  });

  describe('healthCheck', () => {
    it('should return true when service is healthy', () => {
      service.healthCheck().subscribe((healthy) => {
        expect(healthy).toBeTrue();
      });

      const req = httpMock.expectOne(`${baseUrl}/languages`);
      req.flush([{ code: 'en', name: 'English' }]);
    });

    it('should return false when service is down', () => {
      service.healthCheck().subscribe((healthy) => {
        expect(healthy).toBeFalse();
      });

      const req = httpMock.expectOne(`${baseUrl}/languages`);
      req.error(new ErrorEvent('Network error'));
    });
  });
});