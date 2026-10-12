# Client Demo Guide (mock-data release)

This build is a **clickable design + behavior demo**. It runs entirely in the
browser with bundled sample data — no server, no database, no real accounts.

## Run it

```bash
npm install
npm start            # → http://localhost:4200 (or --port 4400 if taken)
```

Verified demo build (static hosting):

```bash
npm run build        # → dist/storefront/browser (serve with SPA fallback, see HOSTING.md)
```

Requirements: Node 20/22 + npm 10. Nothing else — the demo works with the
backend stopped (there is nothing to stop; it never calls one).

## Try this (5-minute tour)

1. Home (`/`): hero, categories, product grids. Switch language (header) —
   all 8 work (EN, AR, CS, DE, FR, IT, PL, SK); Arabic flips to full RTL.
2. Catalog (`/products`): search with suggestions, category/price/
   availability/sale filters, 6 sort modes, pagination — state lives in the URL.
3. Product (`/products/argan-oil`): gallery, variant picker, quantity stepper,
   related products. `kohl-eyeliner` shows low-stock; `hibiscus-soap` is
   out of stock (button disabled, badge honest).
4. Click **Add to cart** as a guest → sign-in gate with friendly reason;
   register (any details — demo only) → the click completes once after login.
5. Cart (`/cart`): badge matches contents, quantity clamps to stock, totals
   derived, clear asks for confirmation.
6. Checkout: pick city + hotel (Marsa Alam / Hurghada samples) → quoted fee in
   totals (free ≥ $75); submit twice fast → one order (double-submit guard).
7. Confirmation: order number + summary; **WhatsApp / Email buttons open the
   external app with a pre-filled message — nothing is sent automatically.**
8. Favorites (`/favorites`): toggle, no duplicates, move-to-cart.
9. Orders (`/orders`): history + details of demo orders on this browser.

## What's mocked (demonstration data, not production)

- Catalog, categories, hotel directory, fees ($6–$12 samples), $75 threshold.
- Accounts: localStorage demo session — **not secure, not real.**
- Orders: stored in this browser only (`novamart.orders.v1`); the confirmation
  confirms a **local demo order**, never a server-persisted one.
- Prices in USD base; currency switching converts for display with static rates.
- Images: Unsplash CDN with automatic fallback.

## Needs the future backend

Real accounts, server-persisted orders, real delivery pricing, email/WhatsApp
sending, dashboard-managed catalog. Integration swaps service internals via
`ApiClientService` per `docs/API_CONTRACT.md` + `docs/API_INTEGRATION.md` —
no component rewrites.

## Why this is not a production commerce system

No server validation, no inventory truth, no payment processing (cash on
delivery is recorded as intent only), no data protection review. Do not collect
real customer data with this build.
