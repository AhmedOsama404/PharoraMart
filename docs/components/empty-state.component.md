# EmptyStateComponent

## A. Component identity

- Class `EmptyStateComponent`, selector `app-empty-state`.
- `src/app/shared/components/empty-state.component.ts` (+ `.html`, `.scss`).
- Standalone + OnPush; no spec.

## B. Routing and navigation

No route. Rendered by pages for empty/loading-error/not-found states; the
optional action button emits `actionClick` (pages navigate, e.g. PDP
`goHome()`, cart `go('/products')`, error retry).

## C. Purpose and business behavior

One consistent status block (icon, title, optional subtitle, optional
action, content slot) so every state looks intentional. Owns no domain
logic — the page decides which state and which action.

## D. Template structure

`.empty[role=status]` → icon circle → `h3` → optional `p` → optional
`p-button` → `<ng-content />`.

## E. TypeScript functions and lifecycle

Inputs only (`icon`, `title`, `subtitle`, `actionLabel`) + `actionClick`
output. No methods or lifecycle.

## F. Inputs, outputs, and events

- Inputs (all strings, all defaulted — component renders standalone safely).
- `@Output() actionClick: EventEmitter<void>` — action-button clicks.

## G. Services and dependencies

PrimeNG `Button` only. Deliberately service-free (fully presentational).

## H. State and data flow

Stateless.

## I. Localization and styling

All text arrives translated via inputs. Dashed-border card, centered;
RTL-safe.

## J. Testing

No spec. Asserted indirectly by page specs querying `app-empty-state`.

## K. Safe modification guide

- New state illustration: add an `icon` value at the call site, not a new
  component.

## L. Common pitfalls

- Putting navigation inside the component (pages own destinations).
