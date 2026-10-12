# Troubleshooting

Symptom → diagnostic steps → verified root cause → fix. Only confirmed
diagnoses are listed here (no speculation).

## Cart badge shows a count but the cart page looks empty

- **Check**: DevTools → Application → Local Storage → `novamart.cart.v1`;
  compare stored `productId`s with catalog ids.
- **Cause (verified)**: the badge counts **all** stored lines while the page
  silently dropped ids missing from the catalog (stale storage after catalog
  changes, removed/deactivated products).
- **Fix (shipped)**: `CartViewService` renders every stored line — unknown
  ids show explicit “No longer available” rows (removable, priced 0);
  money uses available lines only. Regression:
  `cart-view.service.spec.ts` “renders every stored line”.

## Duplicate cart items / badge jumps by more than one per click

- **Check**: read `novamart.cart.v1` after ONE click — one line affected?
- **Cause (verified)**: none found — each entry point calls the single
  `CartStore.add()` once per click and merges by `productId::variantKey`
  (browser-verified: two different buttons → one line, qty 1 → 2).
- **Rule (binding)**: same product + same variant = one line (qty grows);
  different variant = separate line; different products never merge; badge =
  Σ qty. Specs: `favorites-page.component.spec.ts`, `cart.store.spec.ts`.
- If a future change breaks this, suspect nested click handlers or a second
  mutation path bypassing the store.

## Repeated identical toast notifications

- **Cause (verified)**: every logical action announced once, but rapid taps
  stacked identical toasts (5 clicks → 5 toasts) — no ownership policy.
- **Fix (shipped)**: `NotificationService` drops exact repeats inside 1.2 s;
  distinct messages (including errors) always pass. Verified: 5 rapid clicks
  → 1 toast, badge still counts every legitimate click. Spec:
  `notification.service.spec.ts`.

## Product details stuck on loading skeleton

- **Check**: renderer unresponsive + `crumbs()`-style per-cycle allocations.
- **Cause (verified)**: fresh `{ exact: false }` per CD cycle into PrimeNG
  Breadcrumb → `RouterLinkActive.ngOnChanges` → `queueMicrotask` → infinite
  CD loop (bisected + CPU-profiled).
- **Fix (shipped)**: memoized `crumbs()` computed + frozen option constants.
  Never bind freshly allocated objects to component inputs. Spec: crumb
  reference-stability test.

## Broken product images collapse the gallery / raw broken icons

- **Check**: block image CDNs in DevTools (or find 404s in Network); observe
  the gallery frame and thumbnails.
- **Cause (verified)**: a broken `<img>` ignores `aspect-ratio` in Chrome and
  collapses (measured 221×28 instead of 4/3); thumbnails degrade to alt-text
  boxes. One mock image id 404'd (`photo-1532336414038-cf19291763c4`,
  replaced).
- **Fix (shipped)**: shared `handleImgError()` (picsum attempt, then
  `img-gone` hiding the img) + permanent `.img-frame` placeholders behind
  gallery/card images (aspect owned by the frame). Specs:
  `image-fallback.utils.spec.ts`, frame-presence assertions in the PDP and
  product-card specs.

## Product navigation stays at the bottom

- **Cause (verified)**: same-route `:id` navigation reuses the component;
  no scroll restoration configured.
- **Fix (shipped)**: `ScrollService` — instant top on product-id change;
  router-level restoration intentionally off (would yank the viewport on
  catalog filter navigations). Browser-verified `scrollY` 824 → 0.

## Failed hotel quotes / wrong delivery fee

- **Check**: hotel select committed? (label shows it), toasts, `quotedFee`.
- **Causes (verified)**: unknown/inactive hotel id, or quote failure.
- **Behavior (shipped)**: submit blocks with an error instead of charging a
  guess; switching cities resets foreign-city selections. PrimeNG Select
  changes are read via `(onChange)` (proven path in this setup).

## Authentication return-flow problems

- Stuck on login after sign-in → check `returnUrl` (must be internal;
  `safeReturnUrl` rejects external/auth-loop URLs) and that exactly one
  `consume()` ran (double submit is guarded by `busy()`).
- Pending action missing → intents live in memory only; refresh clears them
  (by design). Action runs after navigation so toasts appear in context.

## Missing translations

- Renders the raw key (`cart.unavailable`) → add the key to **all eight**
  `src/app/i18n/*.ts` (parity test lists the gap). Placeholders must match.

## Production refresh failures (404 on nested routes)

- Static host lacks SPA fallback → configure `index.html` fallback
  (see [Hosting](./HOSTING.md)). Verify with direct `/products/<id>` load.

## Local persistence and old data

- Old-shape entries (e.g. pre-hotel orders, retired product ids) render with
  blank/“unavailable” UI, never crash — by design. Clear `novamart.*` keys
  in DevTools to reset mock state.

## Build/test failures

- `tsc` app/spec first (exact errors), then focused spec
  (`--include='**/<name>.spec.ts'`), then suite. Port in use → `--port`;
  Chrome issues → `CHROME_BIN`. Do not dismiss failures as stale without
  re-running.
