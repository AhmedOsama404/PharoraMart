# Getting Started

## Requirements

- **Node.js 20 or 22 LTS** (verified with v22.22.3) and **npm 10+**
  (verified with 10.9.8). Check with `node --version` / `npm --version`.
- **Chrome** (or Chromium) for unit tests — Karma launches headless Chrome.
  Set `CHROME_BIN` if Chrome is not on `PATH`:
  ```powershell
  $env:CHROME_BIN='C:\Program Files\Google\Chrome\Application\chrome.exe'
  ```
- No backend, database, or extra services: this phase is frontend-only
  (`useMockApi: true`).

## Install and run

```bash
npm install
npm start            # dev server with HMR (default http://localhost:4200)
```

If the port is taken, use another one: `npx ng serve --port 4400`.

## Project scripts (from `package.json`)

| Command | What it does |
|---|---|
| `npm start` | `ng serve` — dev server, HMR, development environment |
| `npm run build` | `ng build` — production build → `dist/storefront/browser` |
| `npm run watch` | Development build in watch mode |
| `npm test` | `ng test` — Karma/Jasmine, single run, headless Chrome |
| `npx tsc --noEmit -p tsconfig.app.json` | App TypeScript check (strict) |
| `npx tsc --noEmit -p tsconfig.spec.json` | Spec TypeScript check |

## Environment setup

Public frontend settings live in `src/environments/environment.ts`
(production build) and `src/environments/environment.development.ts`
(`ng serve`, via `fileReplacements` in `angular.json`). Both currently use
mock mode. Key settings: `apiBaseUrl`, `useMockApi`, `defaultLang`,
`defaultCurrency`, `supportEmail`, `whatsappNumber`, `contactMode`,
`businessHours`, `freeShippingThreshold`, `pageSize`. Everything bundled here
is public — never put secrets in these files.

## TypeScript checks and tests

```bash
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.spec.json
npm test             # 128 specs, ChromeHeadless; see docs/TESTING.md
```

## Production build

```bash
npm run build
```

Succeeds with zero errors; budgets enforced in `angular.json`
(initial ≤ 1.2 MB warning / 2 MB error). Output is a static SPA — see
[Hosting](./HOSTING.md) for the fallback/compression/cache checklist.

## How to verify the application is working

1. `npm start`, open the printed URL: the homepage renders hero, categories,
   and product grids with no console errors.
2. Open `/products/karkadeh-hibiscus` directly: product details render
   (gallery, price, variants, related).
3. Register an account, add a product (cart badge → 1), open `/cart`:
   the line, quantity controls and totals agree.
4. Switch language to Arabic: layout flips to RTL; to German: LTR German text.
5. Checkout with a Marsa Alam hotel: the quoted fee appears in the totals;
   confirm → order confirmation with order number.

## Common setup errors

| Symptom | Cause / fix |
|---|---|
| `Port 4200 is already in use` | Another process holds it; serve with `--port 4400` |
| `CHROME_BIN` / Chrome launch failure | Install Chrome or set `$env:CHROME_BIN` (see above) |
| `npm install` peer conflicts | Use the pinned versions in `package-lock.json`; do not upgrade Angular/PrimeNG independently (PrimeNG 20.3 pairs with Angular 20.3) |
| Blank page, console errors about chunks | Stale `dist/` or HMR state; restart `ng serve` |
| Images not loading offline | Expected: Unsplash CDN with automatic `picsum.photos` fallback |
