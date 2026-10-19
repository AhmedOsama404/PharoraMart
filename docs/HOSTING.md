# Hosting (Cloudflare Pages)

The storefront is a client-rendered Angular 20 SPA served as static files from
Cloudflare Pages. The API lives on Render and PostgreSQL on Neon — see the
backend's `docs/FREE_HOSTING.md` for the full three-repo runbook.

## Live topology

| Item | Value |
|---|---|
| Host | Cloudflare Pages |
| Project | `pharora-storefront` |
| Live URL | `https://pharora-storefront.pages.dev` |
| Production branch | `production` |
| Preview branches | every other branch (`https://<branch>.pharora-storefront.pages.dev`) |
| API | `https://<api-service>.onrender.com/api/v1` |
| Build output | `dist/pharoramart/browser` |

## First-time setup

1. Push this repository with `wrangler.toml`, `public/_redirects` and
   `public/_headers` present.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**
   → select `AhmedOsama404/NovaMart`.
3. Settings:
   - Project name: `pharora-storefront`
   - Production branch: `production`
   - Build command: `npm run build:deploy`
   - Build output directory: `dist/pharoramart/browser`
   - Environment variable (Production **and** Preview):
     `API_BASE_URL=https://<api-service>.onrender.com/api/v1`
   - Environment variable: `NODE_VERSION=22`
4. Save and deploy.

Every push to a non-production branch creates a preview deployment; the
preview URL uses the branch name. Merging into `production` updates the live
site. No GitHub Actions workflow is needed — the old
`.github/workflows/deploy-pages.yml` (GitHub Pages, stale output path) was
removed to avoid duplicate deployments.

## How the API URL is injected

`src/environments/environment.ts` keeps `https://localhost:44389/api/v1` so
local builds are unchanged. `npm run build:deploy` runs
`scripts/set-api-url.mjs`, which replaces `apiBaseUrl` with `API_BASE_URL`
inside the CI workspace only. The script fails the build on a non-HTTPS or
localhost URL, so a bad deploy cannot silently ship a broken endpoint.

## What ships in the build

- `public/_redirects` → SPA fallback (`/* /index.html 200`), so a hard refresh
  on `/products/:id`, `/orders/:id` or any lazy route returns the shell.
- `public/_headers` → `nosniff`, `Referrer-Policy`, `X-Frame-Options`,
  `Permissions-Policy`; `index.html` is `no-cache`.
- Hashed JS/CSS bundles are cached by Cloudflare automatically.
- Default `<base href="/">`; if you host under a sub-path, build with
  `--base-href /sub-path/` and update `wrangler.toml`.

## CORS

The API allows the exact production origins plus the preview host suffixes
`.pharora-storefront.pages.dev` and `.pharora-dashboard.pages.dev`. If you
rename the Pages project or attach a custom domain, update
`Storefront__CorsOrigins__<n>` / `Storefront__CorsOriginSuffixes__<n>` in
Render. CORS is not an authentication boundary: protected calls still require a
JWT.

## Smoke test after a deploy

1. `/` renders in EN; switch to AR → `dir=rtl`; another language → translated.
2. Hard-refresh `/products/<slug>` → 200, no 404 (SPA fallback).
3. Sign in with a real account, place an order → the row appears in the
   dashboard (proves API + database + CORS).
4. DevTools console: no CORS, mixed-content, or 404 errors.
5. Open a branch preview and repeat step 3 (proves preview CORS).

## Limits and known constraints

- No SSR/prerendering: crawlers without JavaScript see only the shell. Add
  Angular SSR if SEO becomes a requirement.
- Uploaded media lives on the API's ephemeral container disk; it disappears on
  redeploy. Move to object storage for permanence.
- Free Render API sleeps after 15 minutes idle (~50 s cold start).
- Preview deployments share the production API and database.
