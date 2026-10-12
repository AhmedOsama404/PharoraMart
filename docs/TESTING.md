# Testing

## Tools

Karma + Jasmine + headless Chrome (`ng test`, single run). Chrome discovery
via `CHROME_BIN` (see [Getting Started](./GETTING_STARTED.md)). 128 specs,
all passing at the last checkpoint.

## Structure

- `*.spec.ts` sits next to its subject (`cart.store.spec.ts`,
  `product-detail-page.component.spec.ts`, …).
- Service specs: real collaborators where cheap (mock `localStorage` via
  `localStorage.clear()`), stubbed `ProductService`/`DeliveryService` with
  controllable `Subject`s for timing tests, mock `NotificationService`.
- Component specs: `RouterTestingHarness` + stub services; template wiring
  asserted through component **outputs** (e.g. `actionClick`), because Karma
  cannot deliver native clicks to PrimeNG buttons reliably — real clicks are
  covered by browser probes (below).
- `fakeAsync`/`tick` for time windows (notification dedup); real timers with
  `done` for service delays.

## Browser testing (available)

puppeteer-core + system Chrome against `ng serve` (port 4400 in past
sessions). Probes are temporary scripts (deleted after use), asserting real
`scrollY`, URLs, badge text, toasts, and zero `pageerror`s. Notable verified
runs: PDP freeze bisection + CPU profile; scroll restoration (`y: 824 → 0`);
gated add-to-cart journey; hotel quote ($10) → order; badge/page agreement
with stale storage; favorites single-line merge; 5 rapid clicks → 1 toast.

## Reproducing the known defects (all have regression specs)

| Defect | Reproduce | Spec |
|---|---|---|
| Badge N / page empty | seed `novamart.cart.v1` with unknown ids | `cart-view.service.spec.ts` |
| Duplicate cart lines | add same product+variant twice; variants; two products | `favorites-page.component.spec.ts`, `cart.store.spec.ts` |
| Toast flood | 3 identical `success()` in `fakeAsync` | `notification.service.spec.ts` |
| PDP infinite skeleton | per-cycle-new `crumbs()` (assert reference stability) | `product-detail-page.component.spec.ts` |
| Stale product on rapid nav | flush superseded subject after navigating on | same |
| Scroll stuck at bottom | unit: scroll service called on id change; browser: `scrollY` probe | same + probe |
| Unsafe return URL | `safeReturnUrl()` matrix | `pending-action.service.spec.ts` |

## Adding regression tests

1. Put the spec next to the subject; name the defect in the `describe`.
2. Control async with `Subject`s (services) or `fakeAsync` (timers).
3. Assert terminal UI states (loading/ready/error), not internals.
4. Run the focused spec (`--include='**/<name>.spec.ts'`), then the suite.

## Full verification suite and release checklist

```bash
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.spec.json
npm test                        # expect TOTAL: N SUCCESS, 0 FAILED
npm run build                   # expect zero errors
```

Release checklist: suite green, build green, i18n parity green, manual
smoke (home → product → cart → checkout → confirmation) in EN + AR,
[Hosting](./HOSTING.md) smoke tests on the deployed URL, changelog updated.
