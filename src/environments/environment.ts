export const environment = {
  production: true,
  apiBaseUrl: 'https://localhost:44389/api/v1',
  useMockApi: false,
  // Public business identity (all frontend-bundled values are public by
  // definition — never put secrets here). The future dashboard owns the real
  // values; these defaults keep the storefront coherent until then.
  appName: 'Pharora',
  defaultLang: 'en' as const,
  defaultCurrency: 'USD' as const,
  supportEmail: 'support@pharora.example.com',
  whatsappNumber: '201001234567',
  contactMode: 'both' as 'whatsapp' | 'email' | 'both',
  businessHours: 'Daily 9:00 – 22:00 (Egypt time)',
  // Mock-era pricing policy: per-hotel fees come from the hotel directory and
  // are quoted via DeliveryService; free shipping above the threshold below.
  freeShippingThreshold: 75,
  pageSize: 12,
};
