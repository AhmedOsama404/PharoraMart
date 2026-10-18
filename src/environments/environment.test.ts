export const environment = {
  production: false,
  // Unit tests are hermetic: mock mode with no backend dependency.
  // (Development live mode is configured separately in
  // environment.development.ts and never affects this file.)
  apiBaseUrl: 'http://localhost:5086/api/v1',
  useMockApi: false,
  appName: 'Pharora',
  defaultLang: 'en' as const,
  defaultCurrency: 'USD' as const,
  supportEmail: 'support@pharora.example.com',
  whatsappNumber: '201001234567',
  contactMode: 'both' as 'whatsapp' | 'email' | 'both',
  businessHours: 'Daily 9:00 – 22:00 (Egypt time)',
  freeShippingThreshold: 75,
  pageSize: 12,
};
