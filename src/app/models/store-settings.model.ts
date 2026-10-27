// Admin-managed, PUBLIC store settings served by GET /api/v1/store/settings
// (see PharoraMart.Application.Dtos.StoreSettingsDto). The dashboard owns the
// values; the storefront keeps the bundled `environment.*` values as a
// fallback until (and unless) the API answers.

/** How a customer may reach the store. */
export type ContactMode = 'whatsapp' | 'email' | 'both';

export interface StoreSettings {
  /** International WhatsApp number, digits only (no '+' and no spaces). */
  whatsappNumber: string;
  supportEmail: string;
  businessHours: string;
  contactMode: ContactMode;
}
