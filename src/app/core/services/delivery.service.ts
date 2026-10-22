import { Injectable } from '@angular/core';
import { Observable, catchError, delay, map, of, shareReplay, tap, throwError } from 'rxjs';
import type { DeliveryQuote, Hotel } from '../../models/hotel.model';
import { environment } from '../../../environments/environment';
import { ApiClientService } from '../api/api-client.service';
import { toHotel, type BackendHotel, type BackendDeliveryQuote } from '../api/delivery.mapper';
import { PriceResolverService } from './price-resolver.service';

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
  /** Live-mode directory cache (populated by hotels(); mock mode uses HOTELS). */
  private liveHotels: Hotel[] | null = null;
  /** The one live directory request of this session (see hotels()). */
  private hotelsRequest$: Observable<Hotel[]> | null = null;

  constructor(private api: ApiClientService, private prices: PriceResolverService) {}

  /** Active hotels in dashboard order. */
  hotels(): Observable<Hotel[]> {
    if (!environment.useMockApi) {
      // The checkout page needs the directory and the city list, which is
      // derived from the same directory: one request serves both.
      if (!this.hotelsRequest$) {
        let request$!: Observable<Hotel[]>;
        request$ = this.api.get<BackendHotel[]>('hotels').pipe(
          map((items) => items.map(toHotel)),
          tap((items) => (this.liveHotels = items)),
          // A failed load must not be remembered: the next caller may retry.
          catchError((err: unknown) => {
            if (this.hotelsRequest$ === request$) this.hotelsRequest$ = null;
            return throwError(() => err);
          }),
          // `refCount: false` keeps the directory for the whole session.
          shareReplay({ bufferSize: 1, refCount: false }),
        );
        this.hotelsRequest$ = request$;
      }
      return this.hotelsRequest$;
    }
    return of(
      [...HOTELS].filter((h) => h.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    ).pipe(delay(200));
  }

  /**
   * Drops the cached directory and loads it again. The checkout offers this
   * when the first load failed, so a transient outage does not need a full
   * page reload. The cities are derived from the same request.
   */
  reloadHotels(): Observable<Hotel[]> {
    this.hotelsRequest$ = null;
    return this.hotels();
  }

  /** Distinct cities derived from the active list (future hotels add cities). */
  cities(): Observable<string[]> {
    return this.hotels().pipe(map((list) => [...new Set(list.map((h) => h.city))]));
  }

  hotelById(id: string): Hotel | undefined {
    const dir = environment.useMockApi ? HOTELS : (this.liveHotels ?? []);
    const found = dir.find((h) => h.id === id);
    return found?.isActive ? found : undefined;
  }

  /** Case-insensitive search across name, area and city (active hotels only). */
  search(term: string, city?: string): Hotel[] {
    const dir = environment.useMockApi ? HOTELS : (this.liveHotels ?? []);
    const q = term.trim().toLowerCase();
    return dir.filter((h) => {
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
  quoteFor(hotelId: string, subtotal = 0, currency = 'USD'): Observable<DeliveryQuote> {
    if (!environment.useMockApi) {
      return this.api
        .post<BackendDeliveryQuote>('delivery/quote', { hotelId, subtotal, currency })
        .pipe(map((q) => ({ hotelId: q.hotelId, fee: q.fee, currency: q.currency, source: 'api' as const, exchangeRateDate: q.exchangeRateDate ?? undefined })));
    }
    const hotel = this.hotelById(hotelId);
    if (!hotel) {
      // Missing or inactive hotel: fail loudly so checkout blocks instead of
      // charging a wrong fee.
      return throwError(() => new Error('unknown-hotel'));
    }
    const fee = this.prices.resolve(hotel.deliveryFee, hotel.deliveryFeeCurrency ?? 'USD');
    const threshold = this.prices.resolve(75, 'USD');
    if (!fee || !threshold) return throwError(() => new Error('exchange-rates-unavailable'));
    return of({
      hotelId,
      fee: subtotal >= threshold.amount ? 0 : fee.amount,
      currency: fee.currency,
      source: 'sample' as const,
      exchangeRateDate: this.prices.exchangeRateDate(),
    }).pipe(delay(250));
  }
}
