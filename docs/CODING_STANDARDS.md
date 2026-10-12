# Coding Standards

Practical conventions actually used in this codebase. Examples reference real files.

## TypeScript and strict typing

- Strict mode stays on. No `any` in app code (specs may cast through
  `unknown` for protected-member access, named as `Exposed`).
- Prefer explicit interfaces in `models/`; use `type X \| null` over
  non-null assertions. The remaining `!` usages are limited to template
  branches already narrowed by `@if` state checks.

```ts
// Good: total failure surface is one terminal state (product-detail-page.component.ts)
private loadState(id: string): Observable<ProductDetailState> { ... }
// Bad: three booleans that can contradict each other
loading = false; loaded = false; hasError = false;
```

## Naming

- Services: `<Domain>Service` for data, `<Thing>Store` for client state
  (`CartStore`, `FavoritesStore`), `<Thing>Service` for stateless helpers.
- Signals holding view state are `protected readonly`-style class fields;
  private collaborators use `private`.
- Translation keys mirror the UI: `cart.unavailable`, `checkout.hotel`.

## Components

- One purpose per component; presentation + user intent only.
- Always separate `.ts` / `.html` / `.scss` (`templateUrl`/`styleUrl`).
  Only the root `App` shell (`<router-outlet />`) is intentionally inline.
- `OnPush` everywhere. Keep template bindings referentially stable:
  **never call methods that allocate arrays/objects from bindings** —
  use memoized `computed` or caches (this exact mistake once froze the
  product page via `RouterLinkActive`; see `TROUBLESHOOTING.md`).
- No HTTP, no mock-data imports, no hardcoded URLs in components.

## Services and state ownership

- One authoritative source per domain (`CartStore.lines`,
  `FavoritesStore.ids`, `AuthService.user`). Consumers derive; nobody keeps a
  shadow copy (see `STATE_MANAGEMENT.md`).
- Mutations live in the owner (`cart.add/setQty/remove/clear`); pages only
  call them and show toasts.
- HTTP only via `ApiClientService`; services map errors to terminal states.

## Signals and observables

- Signals for state, `computed` for derivations, RxJS for async flows
  (`switchMap` cancels obsolete requests; `debounceTime` on search input).
- `takeUntilDestroyed()` for component subscriptions; root services with
  app-lifetime subscriptions need none (documented where applicable).

## Error handling

- Every async flow ends in a terminal UI state (loading/ready/not-found/error).
- Fail loudly in services (`throwError`), render explicitly in pages.
- `localStorage` parsing is defensive; invalid entries are skipped, never crash.

## DTOs and contracts

- Stable string ids; localized display names never identifiers.
- Optional fields for dashboard-managed growth (`names?`, `sortOrder`,
  `isActive`). Money as `number` (USD base, mock); backend must recompute.

## SCSS, accessibility, localization

- Component-scoped styles reusing `:root` tokens; logical properties
  (`margin-inline-*`, `inset-inline-*`) for RTL; visible `:focus-visible`
  states (global); semantic elements + `aria-label`s on icon-only buttons.
- No UI strings outside `i18n/*.ts`; placeholders (`{count}`) preserved in
  every language; `money`/`formatDate` via locale services (never manual).

## Testing, performance, comments

- New behavior ships with a spec (service logic > component wiring >
  browser probe for scroll/click realities). See `TESTING.md`.
- Measure before optimizing: bundle stats, CPU profiles. Proven wins here:
  stable input references, cached `Intl` formatters, `OnPush`, debounced
  search, pagination.
- Comment *why* (business rules, lifecycle edge cases, integration seams),
  not *what*. No `// Import …` noise.
