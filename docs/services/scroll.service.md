# ScrollService

- File: `src/app/core/services/scroll.service.ts`. Spec: `scroll.service.spec.ts`.
- Root singleton; centralized scroll strategy (no router-level restoration
  configured on purpose — catalog query-param navigations must not yank the
  viewport while typing/filtering).

## Responsibility

`scrollToTop(behavior)` (resets window + document + body scrollers, never
throws), `scrollIntoView(el)`, `currentY()`.

## Consumers

PDP reset effect (instant top on product-id change — the related-navigation
fix), order-detail/confirmation/checkout `ngOnInit`, catalog pagination
(smooth), home category scroll.

## Tests

Scroller reset, `currentY`, safe element scroll.

## Safe extension

New detail-type page → `scrollToTop()` on init; new same-instance param
navigation → effect on the param. Never add router restoration without
re-checking catalog filter UX.
