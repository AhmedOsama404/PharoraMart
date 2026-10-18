import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/services/i18n.service';
import { LocalizedPipe } from './localized.pipe';

describe('LocalizedPipe', () => {
  let pipe: LocalizedPipe;
  let i18n: I18nService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [I18nService] });
    i18n = TestBed.inject(I18nService);
    pipe = new LocalizedPipe(i18n);
  });

  it('renders the translation for the active language', () => {
    i18n.setLang('ar');
    expect(pipe.transform({ en: 'Cosmetics', ar: 'مستحضرات التجميل' }, 'Cosmetics')).toBe(
      'مستحضرات التجميل',
    );
  });

  it('falls back to English, then to the given fallback', () => {
    i18n.setLang('fr');
    expect(pipe.transform({ en: 'Cosmetics' }, 'Cosmetics')).toBe('Cosmetics');
    expect(pipe.transform(undefined, 'Cosmetics')).toBe('Cosmetics');
    expect(pipe.transform({ en: '   ', ar: 'مستحضرات' }, 'Cosmetics')).toBe('Cosmetics');
  });

  it('treats a blank translation as missing rather than rendering empty text', () => {
    i18n.setLang('ar');
    expect(pipe.transform({ en: 'Cosmetics', ar: '  ' }, 'Cosmetics')).toBe('Cosmetics');
  });
});
