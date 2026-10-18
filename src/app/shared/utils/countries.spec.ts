import { countryFlagPath, countryName, phoneCountryOptions } from './countries';

describe('phone country helpers', () => {
  it('localizes country names for the active language', () => {
    expect(countryName('EG', 'en-US')).toBe('Egypt');
    // Arabic must not merely echo the ISO code.
    expect(countryName('EG', 'ar-EG')).not.toBe('EG');
    expect(countryName('EG', 'ar-EG').length).toBeGreaterThan(0);
  });


  it('resolves a local SVG for every callable region, including territory aliases', () => {
    const options = phoneCountryOptions('en-US');
    for (const option of options) {
      expect(countryFlagPath(option.value)).toMatch(/^\/flags\/4x3\/[a-z-]+\.svg$/);
    }
    expect(countryFlagPath('AC')).toBe('/flags/4x3/sh-ac.svg');
    expect(countryFlagPath('TA')).toBe('/flags/4x3/sh-ta.svg');
    expect(countryFlagPath('1A')).toBe('');
  });
  it('lists callable regions with localized names and dial codes', () => {
    const options = phoneCountryOptions('en-US');
    const egypt = options.find((option) => option.value === 'EG');
    expect(egypt?.dial).toBe('20');
    expect(egypt?.label).toContain('Egypt');
    expect(egypt?.label).toContain('+20');
    expect(options.length).toBeGreaterThan(150);
  });
});