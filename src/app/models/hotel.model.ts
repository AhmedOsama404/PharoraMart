import type { LocalizedText } from './product.model';

// Delivery destination (hotel) contract. Stable ids only — display names are
// never identifiers. Designed so the future dashboard can add, rename,
// rezone, reprice, activate or deactivate hotels without an app release,
// and so the ASP.NET Core API can serve the same shape (see API_CONTRACT.md).
export interface Hotel {
  /** Stable id, e.g. 'jaz-aquamarine-marsa-alam'. */
  id: string;
  /** Default (English) display name. */
  name: string;
  /** Localized names where available; hotel names usually stay as-is. */
  names?: LocalizedText;
  /** City/region, e.g. 'Marsa Alam'. Data-driven: new cities appear automatically. */
  city: string;
  /** Sub-area, e.g. 'Port Ghalib', 'Makadi Bay'. */
  area?: string;
  /** Inactive hotels are hidden from selection; existing orders keep snapshots. */
  isActive: boolean;
  /** Dashboard-controlled ordering. */
  sortOrder: number;
  /** Pricing zone reference for future zone-based rules. */
  zoneId: string;
  /**
   * SAMPLE delivery fee in USD (mock data only, clearly not production
   * pricing). The backend quote is authoritative in production; the frontend
   * only displays what the quote returns (see DeliveryService).
   */
  deliveryFee: number;
  /** Original currency of the configured fee; mock fixtures default to USD. */
  deliveryFeeCurrency?: string;
  /** Optional notes/restrictions shown at checkout, e.g. gate delivery hours. */
  notes?: string;
  coordinates?: { lat: number; lng: number };
}

// Quote returned for a destination. `source` tells the UI whether the fee
// came from local sample data or the authoritative backend.
export interface DeliveryQuote {
  hotelId: string;
  fee: number;
  currency: string;
  source: 'sample' | 'api';
  exchangeRateDate?: string;
  etaDays?: string;
}
