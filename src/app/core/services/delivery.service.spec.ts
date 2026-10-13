import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { DeliveryService } from './delivery.service';

describe('DeliveryService (mock directory)', () => {
  let svc: DeliveryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(DeliveryService);
  });

  it('lists active Marsa Alam and Hurghada hotels in dashboard order', (done) => {
    svc.hotels().subscribe((hotels) => {
      expect(hotels.length).toBeGreaterThan(5);
      expect(hotels.every((h) => h.isActive)).toBeTrue();
      expect(hotels.some((h) => h.city === 'Marsa Alam')).toBeTrue();
      expect(hotels.some((h) => h.city === 'Hurghada')).toBeTrue();
      const orders = hotels.map((h) => h.sortOrder);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
      done();
    });
  });

  it('hides inactive hotels everywhere', (done) => {
    svc.hotels().subscribe((hotels) => {
      expect(hotels.find((h) => h.id === 'closed-demo-hotel')).toBeUndefined();
      expect(svc.hotelById('closed-demo-hotel')).toBeUndefined();
      expect(svc.search('demo')).toEqual([]);
      done();
    });
  });

  it('searches across name, area and city, optionally filtered by city', () => {
    expect(svc.search('makadi').map((h) => h.id)).toContain('makadi-spa');
    expect(svc.search('', 'Hurghada').every((h) => h.city === 'Hurghada')).toBeTrue();
    expect(svc.search('zzz-no-hotel')).toEqual([]);
  });

  it('quotes different fees for different hotels', (done) => {
    svc.quoteFor('jaz-aquamarine-marsa-alam').subscribe((a) => {
      svc.quoteFor('sahl-hasheesh-palace').subscribe((b) => {
        expect(a.fee).toBeGreaterThan(0);
        expect(b.fee).toBeGreaterThan(0);
        expect(a.fee).not.toBe(b.fee);
        expect(a.source).toBe('sample');
        done();
      });
    });
  });

  it('fails loudly for missing or inactive hotels (checkout must block)', (done) => {
    svc.quoteFor('no-such-hotel').subscribe({
      next: () => done.fail('should have errored'),
      error: (e: Error) => {
        expect(e.message).toBe('unknown-hotel');
        done();
      },
    });
  });

  it('derives cities from data so future hotels add cities automatically', (done) => {
    svc.cities().subscribe((cities) => {
      expect(cities).toContain('Marsa Alam');
      expect(cities).toContain('Hurghada');
      done();
    });
  });
});
