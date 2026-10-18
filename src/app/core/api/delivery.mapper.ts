import type { Hotel } from '../../models/hotel.model';
import type { BackendLocalizedText } from './catalog.mapper';

/** Single typed boundary for hotel + delivery-quote DTOs (API_CONTRACT.md). */

export interface BackendHotel {
  id: string;
  name: string;
  names?: BackendLocalizedText | null;
  city: string;
  area?: string | null;
  isActive: boolean;
  sortOrder: number;
  zoneId: string;
  deliveryFee: number;
  deliveryFeeCurrency?: string;
  notes?: string | null;
  coordinates?: { lat: number; lng: number } | null;
}

export interface BackendDeliveryQuote {
  hotelId: string;
  fee: number;
  currency: string;
  source: string;
  exchangeRateDate?: string | null;
}

export function toHotel(h: BackendHotel): Hotel {
  return {
    id: h.id,
    name: h.name,
    names: h.names ?? undefined,
    city: h.city,
    area: h.area ?? undefined,
    isActive: h.isActive,
    sortOrder: h.sortOrder,
    zoneId: h.zoneId,
    deliveryFee: h.deliveryFee,
    deliveryFeeCurrency: h.deliveryFeeCurrency ?? 'USD',
    notes: h.notes ?? undefined,
    coordinates: h.coordinates ? { lat: h.coordinates.lat, lng: h.coordinates.lng } : undefined,
  };
}
