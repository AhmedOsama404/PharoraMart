# Pharora Hosting Checklist (Static SPA)

> The storefront is a client-rendered Angular SPA. This checklist prepares a
> future deployment; it does not claim a deployment has occurred. The app still
> runs on **mock data** (`useMockApi: true`) — see README “Known limitations”.

## Build

```bash
npm ci
npm run build        # production output in dist/storefront/browser (verified)
```

Build budgets are enforced (`angular.json`: 1.2 MB warning / 2 MB error on
the initial bundle; last verified production build: 1.03 MB / 236 KB
transfer, zero errors).

`ng serve` uses `src/environments/environment.development.ts`;
`ng build` (default `production`) uses `src/environments/environment.ts`.
Public settings (API base URL, WhatsApp number, support email, business hours,
contact mode) live there — all frontend-bundled values are public by
definition. Never put secrets in these files.

## Static hosting / CDN requirements

1. **SPA fallback**: every unknown path must serve `index.html` (HTTP 200),
   otherwise refresh on nested routes (`/products/:id`, `/orders/:id`) 404s.
   - Static hosts: configure a rewrite/fallback rule to `/index.html`.
   - CDN: set the error-document / fallback to `index.html` with 200.
2. **Base path**: default `<base href="/">`. For sub-path hosting
   (e.g. `example.com/shop/`), build with `ng build --base-href /shop/`.
   Asset paths (`favicon.svg`) are relative to the base href.
3. **HTTPS**: required (auth flows, even mock, plus payment-adjacent trust).
4. **Compression**: enable Brotli/Gzip for JS/CSS/HTML/SVG/JSON at the edge.
5. **Cache headers**:
   - Hashed bundles (`main-*.js`, chunks, `styles-*.css`): `Cache-Control:
     public, max-age=31536000, immutable`.
   - `index.html`: `Cache-Control: no-cache` (must revalidate so new deploys
     are picked up).
   - `favicon.svg`: long cache is fine (fingerprinted by content change).
6. **Security headers (recommended)**: `Content-Security-Policy` allowing the
   image CDNs (`images.unsplash.com`, `picsum.photos`) if remote images stay;
   `Referrer-Policy`, `X-Content-Type-Options: nosniff`.

## SEO limits (honest)

- Document titles localize per route (`LocalizedTitleStrategy`); static meta
  description + Open Graph tags ship in `index.html`.
- Product content renders client-side: crawlers without JS execution will see
  the shell only. Server-side rendering / prerendering is NOT configured.
  Add it (Angular SSR) before claiming full SEO coverage.

## Smoke test after deploy

1. `/` renders in EN; switch to AR → `dir=rtl`; to DE → translated + LTR.
2. `/products/karkadeh-hibiscus` direct URL loads (fallback works).
3. Refresh on `/orders` (guarded) → login → back to `/orders` after sign-in.
4. Checkout with a hotel shows the quoted fee; confirmation renders.
5. No console errors; images fall back gracefully offline.
