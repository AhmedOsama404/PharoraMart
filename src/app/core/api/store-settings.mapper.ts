import type { ContactMode } from '../../models/store-settings.model';

/**
 * Single typed boundary for the public store-settings DTO
 * (GET /api/v1/store/settings). The backend JSON is camelCase and every
 * field is optional, so the mapper normalizes the shape and drops values
 * that are not usable strings. `defaultCurrency` is the currency the store
 * prices in; it is only honoured when the backend publishes a currency the
 * storefront actually supports.
 */
export interface BackendStoreSettings {
  whatsappNumber?: string | null;
  supportEmail?: string | null;
  businessHours?: string | null;
  contactMode?: string | null;
  defaultCurrency?: string | null;
}

/** The DTO after normalization; blank fields stay blank (the caller falls back). */
export interface ParsedStoreSettings {
  whatsappNumber: string;
  supportEmail: string;
  businessHours: string;
  /** null when the payload carries an unknown mode. */
  contactMode: ContactMode | null;
  /** null when the payload carries no (or an unknown) currency. */
  defaultCurrency: string | null;
}

const CONTACT_MODES: readonly string[] = ['whatsapp', 'email', 'both'];

/** A trimmed string; anything that is not a usable string becomes ''. */
function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

/** The contact mode, or null when the payload carries an unknown value. */
export function toContactMode(value: unknown): ContactMode | null {
  return typeof value === 'string' && CONTACT_MODES.includes(value) ? (value as ContactMode) : null;
}

/**
 * Normalizes the DTO. Missing or blank values stay empty so the caller can
 * fall back to the bundled environment defaults per field.
 */
export function toStoreSettings(raw: unknown): ParsedStoreSettings {
  const src = (raw ?? {}) as BackendStoreSettings;
  const currency = toText(src.defaultCurrency).toUpperCase();
  return {
    whatsappNumber: toText(src.whatsappNumber),
    supportEmail: toText(src.supportEmail),
    businessHours: toText(src.businessHours),
    contactMode: toContactMode(src.contactMode),
    defaultCurrency: currency || null,
  };
}
