# ContactService

- File: `src/app/core/services/contact.service.ts`. Spec: `contact.service.spec.ts`.
- Root singleton; honest external-contact adapter.

## Responsibility

Builds (never sends) order messages: reference, items × qty, subtotal, fee,
total, cash-on-delivery marker, customer contact, hotel/city/room, notes.
Opens official `https://wa.me/<number>?text=<encoded>` or `mailto:` links —
UI copy states the app was *opened*, never that anything was delivered.

## Public API

- `mode` / `whatsappNumber` / `supportEmail` / `businessHours`
  (environment-backed, dashboard-owned later).
- `buildWhatsAppMessage(order)`, `whatsappUrl(order)`, `openWhatsApp(order)`,
  `emailUrl(order)`, `openEmail(order)`.

## Dependencies

`CurrencyService` (money lines), `I18nService` (labels), `environment`.

## Consumers

Confirmation contact card, footer (email/number/hours display).

## Tests

wa.me shape + encoded reference, message contents (hotel/fees/contact),
mailto shape.

## Safe extension

Real delivery moves server-side (`POST /notifications/*`); this adapter
keeps preparing/linking. No secrets here — ever.
