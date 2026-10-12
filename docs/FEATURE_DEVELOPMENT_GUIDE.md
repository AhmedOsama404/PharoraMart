# Feature Development Guide

Numbered, in-order instructions. All paths relative to the repo root.

## 1. Adding a component

1. Create `src/app/<area>/<name>.component.{ts,html,scss}` (always separate).
2. Standalone + `OnPush` + `templateUrl`/`styleUrl`; import only what the
   template uses.
3. Keep logic in `.ts` (typed, small methods), presentation in `.html`,
   tokens-based rules in `.scss` (logical properties for RTL).
4. Verify: `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`.

## 2. Adding a storefront page and route

1. Create the component trio under `src/app/features/<journey>/`.
2. Add the route to `<journey>.routes.ts` with `loadComponent` and
   `data: { titleKey: 'meta.<page>' }` (add the `meta.*` key to all eight
   `src/app/i18n/*.ts` first — parity test enforces it).
3. Guard account pages with `canActivate: [authGuard]`.
4. Add scroll behavior: new detail-type page → `ScrollService.scrollToTop()`
   in `ngOnInit`; same-instance param navigation → effect on the id param.
5. Verify: navigate directly, refresh, Back/Forward; `npm test`, build.

## 3. Adding a product

1. Append a `Seed` in `src/app/data-access/mock-data.ts` (stable `id`/`sku`,
   real category id, price/sale, images, rating, stock, flags, tags,
   neutral attributes — **no medical claims**).
2. It flows automatically into home sections, catalog, search, related.
3. Verify: catalog shows it; PDP renders; `MAX_CATALOG_PRICE` adapts.

## 4. Adding a category

1. Append to `MOCK_CATEGORIES` in `src/app/data-access/mock-data.ts`:
   stable `id`, English `name`, full `names` map (all eight languages or
   English-only + fallback), `description` (+`descriptions` if translated),
   `image`, `sortOrder`, `isActive: true`.
2. Home cards, catalog filter, and PDP names pick it up from
   `ProductService.categories()` — no component hardcoding needed.
3. Verify: home + catalog filter in EN and AR; key parity untouched (names
   are data, not i18n keys).

## 5. Editing, reordering, activating, deactivating, removing a category

- Edit/rename/reorder: change `names`/`sortOrder` in the data row.
- Deactivate: `isActive: false` — hidden from navigation/filters; its
  products still render (name falls back to the id); stored cart lines for
  its products show as unavailable rows (removable) instead of vanishing.
- Remove: products pointing at the id keep rendering via the same fallback;
  existing orders keep their snapshots. Never reuse a removed id.
- (Future: the dashboard edits these fields via API; the storefront already
  reads them through `ProductService`.)

## 6. Adding localized content

- UI strings → `src/app/i18n/*.ts` (all eight, placeholders intact).
- Dashboard-managed names → `names`/`descriptions` maps + `pickLocaleText()`.
- Product/hotel proper names stay untranslated by design.

## 7. Adding a language

See [Localization](./LOCALIZATION.md) (copy `en.ts`, extend
`i18n.config.ts`, run parity tests).

## 8. Adding a product variant

Add `{ id, name, options }` to the product's `variants`. Cart identity
(`productId::variantKey`) and PDP selection handle it; checkout carries
`variantLabel` into the order. Test same/different-variant merging.

## 9. Adding a cart action

Add the mutation to `CartStore` (single place), expose it through
`CartViewService` if display needs it, call it from the page handler with
exactly one toast. Update [Cart and Checkout](./CART_AND_CHECKOUT.md) if the
identity/totals rules change.

## 10. Adding a form and validation

Reactive Forms + shared `validators.ts` + localized `validation.*` messages;
`markAllAsTouched()` on invalid submit; loading + server-error states.

## 11. Adding a hotel or changing a delivery-pricing rule

1. Edit the `HOTELS` directory in `src/app/core/services/delivery.service.ts`
   (stable `id`, `city`, `zoneId`, sample `deliveryFee`, `isActive`).
2. Checkout city filter, hotel search, option labels and quotes follow
   automatically. Blocked submit on unknown/failed quotes is already handled.
3. Add/extend `delivery.service.spec.ts` cases; verify checkout in EN + AR.
   (Future: same shape over `GET /hotels`, `POST /delivery/quote`.)

## 12. Adding a store setting

1. Add the key to both `src/environments/environment*.ts` files.
2. Read it through `ContactService` (contact settings) or the owning
   service — never import `environment` in components.
3. Document it in README’s configuration table.

## 13. Integrating a future API endpoint

See [API Integration](./API_INTEGRATION.md) (mock-to-real checklist).

## 14. Adding regression tests

Spec next to the subject; name the defect; control async with `Subject`s;
assert terminal states; focused run, then full suite (see
[Testing](./TESTING.md)).

## 15. Updating environment configuration

Change both environment files consistently (or intentionally differently),
keep secrets out, update README + `docs/HOSTING.md` if hosting-relevant.
