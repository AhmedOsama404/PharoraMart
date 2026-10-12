# LocalizedTitleStrategy

- File: `src/app/core/services/title.strategy.ts`. Spec: `title.strategy.spec.ts`.
- Provided as `TitleStrategy` in `app.config.ts`.

## Responsibility

Document titles from route `data.titleKey` resolved against the active
language; re-applies on language change (the router only calls it on
navigation). Routes without a key (product details, which sets its own
product-name title) are left alone.

## Consumers

All routed pages via route metadata (see route table in
COMPONENTS_AND_ROUTES.md).

## Tests

Translated title on navigation, re-apply on switch without navigation,
app-name fallback.

## Safe extension

New route: add `data.titleKey: 'meta.<page>'` + the key in all eight
dictionaries.
