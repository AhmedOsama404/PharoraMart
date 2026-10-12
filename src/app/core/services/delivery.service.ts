import { Injectable } from '@angular/core';
import { Observable, delay, map, of, throwError } from 'rxjs';
import type { DeliveryQuote, Hotel } from '../../models/hotel.model';
import { environment } from '../../../environments/environment';

// Sample hotel directory for Marsa Alam and Hurghada (mock data only).
// Fees are illustrative samples, NOT real delivery prices. The future
// dashboard/API owns the real list and real pricing; the storefront only
// renders whatever this service returns (see API_CONTRACT.md).
const HOTELS: Hotel[] = [
  // Marsa Alam
  { id: 'jaz-aquamarine-marsa-alam', name: 'Jaz Aquamarine Resort', city: 'Marsa Alam', area: 'Coraya Bay', isActive: true, sortOrder: 1, zoneId: 'marsa-alam-north', deliveryFee: 6 },
  { id: 'iberotel-costa-mares', name: 'Iberotel Costa Mares', city: 'Marsa Alam', area: 'Coraya Bay', isActive: true, sortOrder: 2, zoneId: 'marsa-alam-north', deliveryFee: 6 },
  { id: 'brayka-bay', name: 'Brayka Bay Resort', city: 'Marsa Alam', area: 'Brayka Bay', isActive: true, sortOrder: 3, zoneId: 'marsa-alam-central', deliveryFee: 7 },
  { id: 'port-ghalib-palace', name: 'Port Ghalib Palace', city: 'Marsa Alam', area: 'Port Ghalib', isActive: true, sortOrder: 4, zoneId: 'marsa-alam-central', deliveryFee: 7 },
  { id: 'albatros-sea-world', name: 'Albatros Sea World Resort', city: 'Marsa Alam', area: 'Port Ghalib', isActive: true, sortOrder: 5, zoneId: 'marsa-alam-central', deliveryFee: 8 },
  { id: 'sataya-resort', name: 'Sataya Resort', city: 'Marsa Alam', area: 'South Coraya', isActive: true, sortOrder: 6, zoneId: 'marsa-alam-south', deliveryFee: 9 },
  { id: 'closed-demo-hotel', name: 'Closed Demo Hotel', city: 'Marsa Alam', area: 'Old Town', isActive: false, sortOrder: 99, zoneId: 'marsa-alam-central', deliveryFee: 7 },
  // Hurghada
  { id: 'desert-rose', name: 'Desert Rose Resort', city: 'Hurghada', area: 'Hurghada', isActive: true, sortOrder: 1, zoneId: 'hurghada-central', deliveryFee: 8 },
  { id: 'makadi-spa', name: 'Makadi Spa Hotel', city: 'Hurghada', area: 'Makadi Bay', isActive: true, sortOrder: 2, zoneId: 'hurghada-makadi', deliveryFee: 10 },
  { id: 'albatros-palace', name: 'Albatros Palace Resort', city: 'Hurghada', area: 'Hurghada', isActive: true, sortOrder: 3, zoneId: 'hurghada-central', deliveryFee: 8 },
  { id: 'sunrise-crystal', name: 'Sunrise Crystal Bay', city: 'Hurghada', area: 'Hurghada', isActive: true, sortOrder: 4, zoneId: 'hurghada-central', deliveryFee: 9 },
  { id: 'blu-spa-adults', name: 'Blu Spa Resort (Adults Only)', city: 'Hurghada', area: 'Hurghada', isActive: true, sortOrder: 5, zoneId: 'hurghada-central', deliveryFee: 9 },
  { id: 'sahl-hasheesh-palace', name: 'Sahl Hasheesh Palace', city: 'Hurghada', area: 'Sahl Hasheesh', isActive: true, sortOrder: 6, zoneId: 'hurghada-sahl', deliveryFee: 12 },
];

/**
 * Hotel directory + delivery quotation boundary. Mock mode serves the sample
 * list above; real mode will call the API (endpoints in API_CONTRACT.md).
 * Pricing policy (per-hotel sample fees, free-shipping threshold) lives here —
 * never as if/else chains inside checkout components.
 */
@Injectable({ providedIn: 'root' })
export class DeliveryService {
  /** Active hotels in dashboard order. */
  hotels(): Observable<Hotel[]> {
    if (!environment.useMockApi) {
      return throwError(() => new Error('real-api-not-configured'));
    }
    return of(
      [...HOTELS].filter((h) => h.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    ).pipe(delay(200));
  }

  /** Distinct cities derived from the active list (future hotels add cities). */
  cities(): Observable<string[]> {
    return this.hotels().pipe(map((list) => [...new Set(list.map((h) => h.city))]));
  }

  hotelById(id: string): Hotel | undefined {
    const found = HOTELS.find((h) => h.id === id);
    return found?.isActive ? found : undefined;
  }

  /** Case-insensitive search across name, area and city (active hotels only). */
  search(term: string, city?: string): Hotel[] {
    const q = term.trim().toLowerCase();
    return HOTELS.filter((h) => {
      if (!h.isActive) return false;
      if (city && h.city !== city) return false;
      if (!q) return true;
      return `${h.name} ${h.area ?? ''} ${h.city}`.toLowerCase().includes(q);
    }).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /**
   * Delivery quote for a hotel. Mock: local sample fee. Production: the
   * backend quote is authoritative — the frontend displays the returned fee
   * instead of trusting any local calculation.
   */
  quoteFor(hotelId: string): Observable<DeliveryQuote> {
    const hotel = this.hotelById(hotelId);
    if (!hotel) {
      // Missing or inactive hotel: fail loudly so checkout blocks instead of
      // charging a wrong fee.
      return throwError(() => new Error('unknown-hotel'));
    }
    if (!environment.useMockApi) {
      return throwError(() => new Error('real-api-not-configured'));
    }
    return of({
      hotelId,
      fee: hotel.deliveryFee,
      currency: 'USD',
      source: 'sample' as const,
    }).pipe(delay(250));
  }
}
