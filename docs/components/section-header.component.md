# SectionHeaderComponent

## A. Component identity

- Class `SectionHeaderComponent`, selector `app-section-header`.
- `src/app/shared/components/section-header.component.ts` (+ `.html`, `.scss`).
- Standalone + OnPush; no spec.

## B. Routing and navigation

No route. Optional `link` input renders a `routerLink` “view all” (home
sections → `/products`).

## C. Purpose and business behavior

Consistent section heading (title, optional subtitle, optional link) for
home/PDP content blocks.

## D. Template structure

Flex row: title block + conditional link with a directional arrow
(`flip-rtl` class mirrors it in Arabic).

## E. TypeScript functions and lifecycle

Four string inputs, no logic.

## F. Inputs, outputs, and events

`title`, `subtitle`, `link?`, `linkLabel` (all strings).

## G. Services and dependencies

`RouterLink` only.

## H. State and data flow

Stateless.

## I. Localization and styling

Translated inputs; `h2` section size; link in primary color; RTL arrow flip.

## J. Testing

No spec.

## K. Safe modification guide

- New section on a page: drop this in with title/subtitle/link.

## L. Common pitfalls

- Hardcoding section heads per page (drifts apart — reuse this).
