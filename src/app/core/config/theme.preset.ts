import Aura from '@primeng/themes/aura';
import { definePreset } from '@primeng/themes';

// Pharora brand preset: Aura with the primary palette recolored to the
// storefront botanical green (see --primary in styles.scss). Without this,
// PrimeNG inputs/buttons/badges render Aura's default emerald while links,
// headers and custom UI use green — two competing brand colors.
// Scale centers 600/700 on --primary/--primary-hover.
export const NovaPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#edf5f0',
      100: '#d5e9dd',
      200: '#abd3bc',
      300: '#78b696',
      400: '#4c9a72',
      500: '#2f8459',
      600: '#2e7d52',
      700: '#256844',
      800: '#205639',
      900: '#1c4c30',
      950: '#0e2a1a',
    },
  },
});
