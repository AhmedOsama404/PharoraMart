# Translation Reference

Eight dictionaries in `src/app/i18n/<code>.ts` (`en, ar, cs, de, fr, it, pl,
sk`), typed `TranslationDict`, resolved by `I18nService` (`src/app/core/
services/i18n.service.ts`, config in `src/app/core/config/i18n.config.ts`).

## Key organization (top-level sections)

`app, nav, language, currency, hero, home, catalog, product, cart,
favorites, auth, checkout, confirmation, orders, notifications, common,
validation, footer, gate, search, notFound, errors, meta`. Keys mirror the
UI that renders them (e.g. cart summary heading → `confirmation.totals`).

## Adding or renaming a key

1. Add/change it in **all eight** files (identical keys — enforced by the
   key-consistency test comparing full key sets, 200+ keys).
2. Preserve `{placeholders}` exactly (placeholder-parity test fails
   otherwise); never leave empty-string values (rejected by test).
3. Reference it via `i18n.t('section.key')` in templates, or pass the key to
   `NotificationService` (`success/error/info/show`) / `orderStatusLabel` /
   `firstErrorKey` mappings.
4. Dynamic families (never concatenate ad-hoc): `gate.*` (reasons),
   `language.*` (selector), `orders.status*` (statuses), `validation.*`
   (validator map) — all covered by the dyn-key test list.

## Detecting untranslated keys

- Runtime: missing keys render the raw `section.key` string (loud by
  design) — grep screenshots/DOM for dotted lowercase strings.
- Suite: key-consistency (`i18n.service.spec.ts`), placeholder parity,
  no-empty-values, plus render-level specs (`cart-page.component.spec.ts`
  asserts translated headings incl. Arabic).
- One-off full-app scan: extract `i18n.t('…')` + notify keys from
  `src/**` (excluding specs) and resolve against all dictionaries
  (procedure used to find the `checkout.totals` bug; see TROUBLESHOOTING).

## Fallback behavior

- Missing UI key → raw key (never silent English).
- Missing dashboard-managed text (category/hotel names) → English
  (`pickLocaleText`), blank → English.
- Missing locale formatting → `try/catch` with plain fallback in
  `CurrencyService`.

## gotchas

- Do not translate brand/product/SKU/hotel names (data stays as-is).
- `meta.*` keys feed `LocalizedTitleStrategy` via route `data.titleKey`.
- Arabic is the only RTL language; layouts must use logical CSS so new
  strings cannot break direction.
