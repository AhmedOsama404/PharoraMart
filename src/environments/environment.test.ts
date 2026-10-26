export const environment = {
  production: false,
  // Unit tests are hermetic: mock mode with no backend dependency.
  // (Development live mode is configured separately in
  // environment.development.ts and never affects this file.)
  apiBaseUrl: 'http://localhost:5086/api/v1',
  // Mock mode, per the comment above: the unit suite must not depend on a
  // running backend. Commit 1c31940 flipped this to `false` (a live-mode
  // change for the hero-product fix) which left 37 hermetic specs hanging.
  useMockApi: true,
  requestTimeoutMs: 10000,
  getRetryAttempts: 2,
  // Ceiling for the background /health/live check (see environment.ts). Kept
  // identical to the real configs so the probe specs assert the shipped value.
  livenessProbeTimeoutMs: 8000,
  appName: 'Pharora',
  defaultLang: 'en' as const,
  defaultCurrency: 'USD' as const,
  supportEmail: 'support@pharora.example.com',
  whatsappNumber: '201001234567',
  contactMode: 'both' as 'whatsapp' | 'email' | 'both',
  businessHours: 'Daily 9:00 – 22:00 (Egypt time)',
  freeShippingThreshold: 75,
  pageSize: 12,
  // Self-hosted LibreTranslate (free, unlimited, no API keys).
  // Tests mock HTTP, so any value works; use a dummy localhost URL.
  libreTranslateUrl: 'http://localhost:5000',
};
