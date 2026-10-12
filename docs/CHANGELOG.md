# Changelog

Recent, verified storefront work. No fabricated history: entries below
describe changes executed and checked in this workspace. (Earlier checkpoints:
69 passing tests with the 8-language, OnPush, scroll-fix baseline; then the
business phase at 104 tests; cart-consistency phase at 117 tests; translation
+ design-system phase at 121 tests.)


## Unreleased — product-image hardening, store audit, remaining docs (this task)

### Investigated — reported product-details defect (not reproduced as shown)
- The reported AR screenshot (missing title/meta/gallery/buttons content with
  price/stock/category intact) matches no reachable steady state: every
  catalog product renders fully in AR/EGP (DOM-verified h1/meta/tags/gallery/
  description/CTA, 0 errors, 0 failed requests), as do invalid-id, loading,
  error, and no-asset states. Likely a cropped capture, transient, or data
  shape that no longer exists (malformed records now resolve to explicit
  not-found/error states).
- Confirmed + fixed the real robustness gaps it pointed at (below).

### Fixed — broken-image degradation (verified)
- Root cause: a broken `<img>` ignores `aspect-ratio` in Chrome and collapses
  (measured 221×28); thumbnails degraded to alt-text boxes; handlers were
  copy-pasted (one without even a once-guard). One mock id 404'd (replaced).
- Fix: shared `handleImgError()` (picsum attempt, then `img-gone` hiding) +
  permanent `.img-frame` placeholders behind PDP gallery/thumbs and
  product-card media (frames own the aspect box); same handler wired into
  home/hero/tiles/categories, cart, checkout review, confirmation,
  order-detail, and header suggestions.
- Verified: blocked-CDN probe shows clean framed placeholders (734×550
  held), all controls labeled, 0 errors.

### Audit — store-wide sweep (verified)
- 13 routes × EN/AR: correct headings/states, zero horizontal overflow at
  360–1920px, zero raw translation keys, guards redirect correctly.
- Interactions: gated auth journey, hotel quote → order, favorites merge,
  drawer, confirm dialog, toasts — 0 page errors throughout.

### Tests (128 passing, 0 failing)
- New: `image-fallback.utils.spec.ts` (3), `product-card.component.spec.ts`
  (3), PDP frame-presence test. Total 121 → 128.

### Docs
- Component/service docs updated for image behavior; troubleshooting
  image-failure entry; this changelog.


## Unreleased — translation fix, design system, component docs (this task)

### Fixed — `checkout.totals` raw key on the cart page
- Root cause: the cart summary heading asked the `checkout` namespace, but
  the `Totals` label was authored under `confirmation` (copy/paste namespace
  slip). `lookupKey` returns unknown keys verbatim, so `/cart` rendered
  “checkout.totals”. Full-app audit (229 static keys + dynamic families × 8
  dicts) found no other missing keys.
- Fix: template now uses `confirmation.totals` (identical text, no dict churn).
- Verified: new `cart-page.component.spec.ts` (translated heading/rows,
  unavailable rows, Arabic RTL) + browser EN (“Totals”) and AR
  (“الإجماليات”, RTL), zero errors.

### Improved — visual design system
- Stale hero subtitle replaced with the real business (all 8 languages).
- PrimeNG Aura preset recolored to brand indigo (`NovaPreset`,
  `core/config/theme.preset.ts`): buttons/inputs/sliders/badges now match
  links and headers (were default emerald). Verified by screenshot compare.
- Design tokens added (type scale, spacing scale, weights, line heights,
  section rhythm, breakpoints note); system font stack kept deliberately
  (no external font dependency) with Arabic fallbacks documented.
- Duplicated `.field`/label/`.err` rules removed from 4 stylesheets in
  favor of the shared form pattern. Verified: login/AR-cart/PDP/catalog
  screenshots before/after + full suite.

### Docs — per-component handover set
- 22 component documents + index, route table + dependency matrix
  (`COMPONENTS_AND_ROUTES.md`), 15 service documents + index,
  `DATA_MODELS.md`, `TRANSLATION_REFERENCE.md`, updated docs index.
- Link validation: 0 broken links across all docs files.

### Tests (121 passing, 0 failing)
- New: `cart-page.component.spec.ts` (4). Total 117 → 121.

## Unreleased (current workspace)

### Fixed — cart badge counted lines the cart page dropped (critical)
- Root cause: badge summed **all** stored lines; cart/checkout joins silently
  skipped ids missing from the catalog (stale storage, removed products).
- Fix: new `CartViewService` enriches every stored line; unknown ids render
  explicit “No longer available” rows (`cart.unavailable`, all 8 languages),
  removable, priced 0; money uses available lines only. Cart + checkout both
  consume it (join duplication removed).
- Verified: browser probe (badge 3 = 2 rows incl. unavailable, subtotal
  priced-only), `tsc` ×2, suite green, production build green.

### Fixed — duplicate-addition rule codified
- Verified no double-mutation exists (each entry point calls `CartStore.add`
  once; browser: two different favorites buttons → one line qty 1 → 2).
- Binding documented (`productId::variantKey`, badge = Σ qty) in code,
  `STATE_MANAGEMENT.md`, and `CART_AND_CHECKOUT.md`; entry-point specs added.

### Fixed — toast flood on rapid clicks
- `NotificationService` drops exact repeats inside 1.2 s; distinct messages
  (incl. errors) always pass. Verified: 5 rapid clicks → 1 toast, badge 7.

### Changed
- Removed dead `environment.deliveryFee` (no code path used it; quotes +
  free-shipping threshold cover all flows); README table updated.
- `environment.ts` is now the production file (`production: true`),
  `.development` the dev file, `fileReplacements` wired; `index.html` copy
  updated to the cosmetics/herbs business (+ OG tags, preconnects).

### Tests (117 passing, 0 failing)
- New: `cart-view.service.spec` (4), `notification.service.spec` (5),
  `favorites-page.component.spec` (4). Key parity/placeholder/empty-value
  tests auto-cover the new `cart.unavailable` key.

### Docs
- New system under `docs/`: index, getting-started, architecture (+Mermaid),
  project-structure, coding-standards, state-management (+sequence diagram),
  feature-development-guide, cart-and-checkout (+badge-mismatch guide),
  localization, testing, api-integration, troubleshooting, changelog
  (this file). `HOSTING.md` verified against current `angular.json`/`dist`
  layout; `API_CONTRACT.md` extended (localized categories, account-scoped
  cart/favorites, hotels/quotes, server-authoritative totals, store
  settings, ProblemDetails, versioning, C# sketch).
