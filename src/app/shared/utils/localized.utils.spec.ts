import { pickLocaleText } from './localized.utils';

describe('localized.utils', () => {
  const names = { en: 'Herbs', ar: 'أعشاب', de: 'Kräuter' };

  it('returns the active language when available', () => {
    expect(pickLocaleText(names, 'ar')).toBe('أعشاب');
    expect(pickLocaleText(names, 'de')).toBe('Kräuter');
  });

  it('falls back to English for missing languages', () => {
    expect(pickLocaleText(names, 'fr')).toBe('Herbs');
    expect(pickLocaleText({ en: 'Cosmetics' }, 'sk')).toBe('Cosmetics');
  });

  it('falls back to English for blank translations', () => {
    expect(pickLocaleText({ en: 'Herbs', fr: '   ' }, 'fr')).toBe('Herbs');
  });

  it('returns empty string for missing content instead of crashing', () => {
    expect(pickLocaleText(undefined, 'en')).toBe('');
  });
});
