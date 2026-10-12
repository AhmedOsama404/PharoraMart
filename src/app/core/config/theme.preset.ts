import Aura from '@primeng/themes/aura';
import { definePreset } from '@primeng/themes';

// NovaMart brand preset: Aura with the primary palette recolored to the
// storefront indigo (see --primary in styles.scss). Without this,
// PrimeNG inputs/buttons/badges render Aura's default emerald while links,
// headers and custom UI use indigo — two competing brand colors.
// Scale matches Tailwind indigo so 600/700 equal --primary/--primary-hover.
export const NovaPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#eef2ff',
      100: '#e0e7ff',
      200: '#c7d2fe',
      300: '#a5b4fc',
      400: '#818cf8',
      500: '#6366f1',
      600: '#4f46e5',
      700: '#4338ca',
      800: '#3730a3',
      900: '#312e81',
      950: '#1e1b4b',
    },
  },
});
