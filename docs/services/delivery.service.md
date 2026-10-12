# DeliveryService (mock hotel directory)

- File: `src/app/core/services/delivery.service.ts`. Spec: `delivery.service.spec.ts`.
- Root singleton; hotel directory + quotation boundary.

## Responsibility

Sample Marsa Alam/Hurghada hotels (`HOTELS`, labeled SAMPLE — not real
prices) and fee quotes. Pricing policy lives here, never in components.

## Public API

- `hotels()` — active hotels in `sortOrder`; `cities()` (derived distinct
  cities); `hotelById(id)` (undefined for missing/inactive);
  `search(term, city?)`.
- `quoteFor(hotelId)` — `{ hotelId, fee, currency, source: 'sample' }`;
  **fails loudly** (`unknown-hotel`) for missing/inactive ids so checkout
  blocks instead of charging a guess.

## Dependencies

Sample data + `environment` (mock switch). No maps/geocoding (coordinates
are optional metadata for the future API).

## Consumers

Checkout (directory, options, quotes, city-reset validation),
`ContactService` indirectly (order snapshots).

## Tests

Directory order/activity, inactive hiding, search/city filter, differing
fees, loud failure, city derivation.

## Safe extension

`quoteFor()` becomes `POST /delivery/quote` (authoritative); per-zone,
distance, minimum and restriction rules plug in behind it. See
API_CONTRACT §5b.
