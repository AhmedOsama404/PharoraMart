# Pharora Documentation

Developer documentation for the Pharora storefront (Angular 20 + PrimeNG):
cosmetics and herbs for hotel guests in Marsa Alam and Hurghada, in eight
languages, with account-based shopping and hotel delivery. It runs on local
mock data by default and connects to the real ASP.NET Core API in live mode.

**New here? Start with [Learning Path](./LEARNING_PATH.md)** — a course for
developers new to this codebase (no Angular experience assumed) — then work
the hands-on [Tutorials](./TUTORIALS.md). Plain-language definitions:
[Glossary](./GLOSSARY.md).

## Reading order

0. [Learning Path](./LEARNING_PATH.md) — course map. Start here.
1. [Getting Started](./GETTING_STARTED.md) — install, run, verify. Start here.
2. [Architecture](./ARCHITECTURE.md) — how the app is put together (with diagram).
3. [Project Structure](./PROJECT_STRUCTURE.md) — where code lives and why.
4. [Coding Standards](./CODING_STANDARDS.md) — conventions with good/bad examples.
5. [State Management](./STATE_MANAGEMENT.md) — who owns cart, favorites, auth, quotes.
6. [Cart and Checkout](./CART_AND_CHECKOUT.md) — the money path, end to end.
7. [Localization](./LOCALIZATION.md) — eight languages, RTL, adding a language.
8. [Testing](./TESTING.md) — tools, suites, release checklist.
9. [API Integration](./API_INTEGRATION.md) — connecting the future backend.
   Endpoint reference: [API Contract](./API_CONTRACT.md).
   Live-mode behavior: [Live API Cutover](./LIVE_API_CUTOVER.md).
10. [Hosting](./HOSTING.md) — production build and static-hosting checklist.
11. [Troubleshooting](./TROUBLESHOOTING.md) — symptoms → verified fixes.
12. [Changelog](./CHANGELOG.md) — what changed, and why.
13. [Component index](./components/README.md) — every component, linked.
14. [Components & routes](./COMPONENTS_AND_ROUTES.md) — route table + map.
15. [Service index](./services/README.md) — every service/store, linked.
16. [Data models](./DATA_MODELS.md) — contracts and identity rules.
17. [Translation reference](./TRANSLATION_REFERENCE.md) — keys and workflow.
18. [Tutorials](./TUTORIALS.md) — hands-on lessons (tour, new page, forms, tests, debugging, full-stack).
19. [Glossary](./GLOSSARY.md) — plain-language Angular/project terms.

## Common tasks

| I want to… | Read |
|---|---|
| Run the app / fix setup errors | [Getting Started](./GETTING_STARTED.md), [Troubleshooting](./TROUBLESHOOTING.md) |
| Add a page, route, or component | [Feature Development Guide](./FEATURE_DEVELOPMENT_GUIDE.md), [Project Structure](./PROJECT_STRUCTURE.md) |
| Add a product, category, hotel, or setting | [Feature Development Guide](./FEATURE_DEVELOPMENT_GUIDE.md) |
| Change cart, totals, or checkout | [Cart and Checkout](./CART_AND_CHECKOUT.md), [State Management](./STATE_MANAGEMENT.md) |
| Add/translate UI text or a language | [Localization](./LOCALIZATION.md) |
| Write or debug a test | [Testing](./TESTING.md) |
| Connect a real API endpoint | [API Integration](./API_INTEGRATION.md), [API Contract](./API_CONTRACT.md) |
| Deploy the static build | [Hosting](./HOSTING.md) |
| Find where to change a component | [Component index](./components/README.md), [Components & routes](./COMPONENTS_AND_ROUTES.md) |
| Understand a service or data model | [Service index](./services/README.md), [Data models](./DATA_MODELS.md) |
| Work with translations | [Translation reference](./TRANSLATION_REFERENCE.md), [Localization](./LOCALIZATION.md) |
| Understand a past bugfix | [Changelog](./CHANGELOG.md), [Troubleshooting](./TROUBLESHOOTING.md) |

## Conventions used across these docs

- **Verified** = executed against this workspace (command output observed).
- **Mock** = local development implementation, clearly labeled in code and UI.
- **Proposed** = future backend/dashboard contract, not implemented.
- Paths are relative to the repository root (`D:\Default Project`).
- File references name the exact source file (e.g.
  `src/app/core/services/cart.store.ts`).
