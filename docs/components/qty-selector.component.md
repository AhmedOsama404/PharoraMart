# QtySelectorComponent

## A. Component identity

- Class `QtySelectorComponent`, selector `app-qty-selector`.
- `src/app/shared/components/qty-selector.component.ts` (+ `.html`, `.scss`).
- Standalone + OnPush; no spec. Used in cart rows and PDP buy box.

## B. Routing and navigation

None (pure control).

## C. Purpose and business behavior

Bounded stepper: minus/value/plus with `min`/`max` clamping (max = live
stock on both call sites). Emits the clamped value; never mutates the cart
itself.

## D. Template structure

`role=group` pill: round text minus button, live-region value, plus button;
buttons disable at the bounds.

## E. TypeScript functions and lifecycle

- `dec()` → `max(min, qty−1)`; `inc()` → `min(max, qty+1)`; both emit
  `qtyChange`. Inputs: `qty`, `min` (=1), `max` (stock), `ariaLabel`.

## F. Inputs, outputs, and events

- Inputs: `qty: number`, `min = 1`, `max = 99`, `ariaLabel: string`.
- `@Output() qtyChange: EventEmitter<number>`.

## G. Services and dependencies

PrimeNG `Button` only; service-free.

## H. State and data flow

Controlled component: parent owns the value, re-renders on `qtyChange`.

## I. Localization and styling

Localized `ariaLabel` from callers; pill style; disabled states visible.

## J. Testing

No spec. Exercised through cart/checkout specs. Future: bound-clamping spec.

## K. Safe modification guide

- Stock rules live in callers (`max`) and the store (clamp); keep this
  component a dumb clamp-and-emit control.

## L. Common pitfalls

- Writing directly to the cart here (breaks single-mutation ownership).
