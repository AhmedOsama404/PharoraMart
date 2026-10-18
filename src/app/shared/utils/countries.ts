import {
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from 'libphonenumber-js';

/**
 * Region pre-selected when a phone field is empty. The storefront currently
 * ships to Egypt, so this is the sensible default; callers can override it per
 * usage via the phone input's `defaultCountry`.
 */
export const DEFAULT_PHONE_COUNTRY: CountryCode = 'EG';

export interface PhoneCountryOption {
  /** ISO 3166-1 alpha-2 code, stored as the form value's country segment. */
  readonly value: CountryCode;
  /** Country name localized by `Intl.DisplayNames` (EN/AR/…). */
  readonly name: string;
  /** International dial code without the leading "+", e.g. "20". */
  readonly dial: string;
  /** Searchable label combining the localized name and dial code. */
  readonly label: string;
}

// `Intl.DisplayNames` is relatively costly to construct, so cache one per
// locale and reuse it for every country lookup.
const regionNames = new Map<string, Intl.DisplayNames>();

function regionDisplayNames(locale: string): Intl.DisplayNames {
  let names = regionNames.get(locale);
  if (!names) {
    names = new Intl.DisplayNames([locale], { type: 'region' });
    regionNames.set(locale, names);
  }
  return names;
}

/** Local SVG flag path, with aliases for territories named by calling metadata. */
export function countryFlagPath(iso2: string): string {
  const code = iso2.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  const assetCode = code === 'AC' ? 'sh-ac' : code === 'TA' ? 'sh-ta' : code.toLowerCase();
  return `/flags/4x3/${assetCode}.svg`;
}
/** Localized country name, falling back to the ISO code when unavailable. */
export function countryName(iso2: string, locale: string): string {
  try {
    return regionDisplayNames(locale).of(iso2) ?? iso2.toUpperCase();
  } catch {
    return iso2.toUpperCase();
  }
}

// Country options only change with the language, so build them once per locale.
const optionsCache = new Map<string, PhoneCountryOption[]>();

/** Every callable region, sorted by localized name, for the dial-code picker. */
export function phoneCountryOptions(locale: string): PhoneCountryOption[] {
  const cached = optionsCache.get(locale);
  if (cached) return cached;

  const options = getCountries()
    .map((value) => {
      const name = countryName(value, locale);
      const dial = getCountryCallingCode(value);
      return { value, name, dial, label: `${name} (+${dial})` };
    })
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  optionsCache.set(locale, options);
  return options;
}