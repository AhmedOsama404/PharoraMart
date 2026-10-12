# CurrencyService

- File: `src/app/core/services/currency.service.ts`. Spec: `currency.service.spec.ts`.
- Root singleton; currency selection + locale-aware formatting.

## Responsibility

Currency (USD/EUR/CZK/EGP, persisted separately from language) and
`Intl`-based money/date formatting in the active language's locale.
`Intl` instances are cached per locale+currency (prices re-render every CD
through the impure `MoneyPipe`).

## Public API

- `code` signal, `current()` (`{code, symbol, rate}` — USD-base rates),
  `setCurrency` (validated, persisted `novamart.currency`).
- `convert(usd)`, `format(usd)` (locale currency, 0 decimals for CZK/EGP),
  `formatDate(iso)` (medium date + short time).

## Dependencies

`I18nService` (locale + change tracking), `LANG_LOCALES`.

## Consumers

`MoneyPipe`, cart hints/totals, checkout option labels, confirmation,
orders, contact messages.

## Tests

Default USD formatting, conversion + persistence, unknown-code rejection.

## Safe extension

Rates are static samples — a real backend supplies authoritative pricing;
this service stays the display layer.
