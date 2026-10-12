# Localization

Eight languages: `en` (default), `ar` (RTL), `cs`, `de`, `fr`, `it`, `pl`,
`sk` (all LTR). Dictionaries live in `src/app/i18n/<code>.ts`, typed as
`TranslationDict` (string map, enforced identical keys).

## Files and keys

- Key naming mirrors the UI: `nav.home`, `cart.unavailable`,
  `checkout.hotel`, `validation.required`, `gate.addToCart`, `meta.cart`.
- Placeholders (`{count}`, `{name}`, `{min}`, `{amount}`, `{q}`,
  `{percent}`) must be preserved in every language — a placeholder test
  fails the suite otherwise.
- Never translate brand names, product names/SKUs, or hotel names unless the
  data model carries localized alternatives (`Category.names`,
  `Hotel.names?` via `pickLocaleText()` with English fallback).

## Fallback behavior

Missing key → the key itself renders (loud, greppable) — never silent
English. Missing/blank *dashboard-managed* text (category/hotel names) →
English fallback (`pickLocaleText`). Empty-string translations are rejected
by test.

## Formatting

Prices/dates/numbers go through `CurrencyService` (`Intl` formatters cached
per locale+currency) using `LANG_LOCALES` (`en-US`, `ar-EG`, `cs-CZ`,
`it-IT`, `pl-PL`, `fr-FR`, `sk-SK`, `de-DE`). Currency selection is
independent of language and persisted separately.

## Switching, persistence, direction

`I18nService.setLang()` updates the signal (entire UI re-renders, no reload),
persists to `localStorage: novamart.lang`, and sets `<html lang dir>`
(`ar` → `rtl`, rest → `ltr`). Layout uses logical CSS properties so RTL just
works, including PrimeNG overlays/menus/toasts. Document titles re-resolve
via `LocalizedTitleStrategy` on navigation and on language change.

## Adding another language

1. Copy `src/app/i18n/en.ts` → `<code>.ts`; translate every value
   (keep keys, placeholders, `{…}` syntax).
2. Extend `src/app/core/config/i18n.config.ts`: `SupportedLang`,
   `SUPPORTED_LANGS`, `LANG_LOCALES`, `LANG_DIRS`, `DICTS`.
3. The language selector (`header.component.ts`) picks it up automatically.
4. Run `npm test` — key-consistency, placeholder, and empty-value tests
   enforce completeness; fix failures before merging.
