import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, PreloadAllModules, TitleStrategy, withComponentInputBinding, withPreloading } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';

import { routes } from './app.routes';
import { apiInterceptor } from './core/api/api.interceptor';
import { LocalizedTitleStrategy } from './core/services/title.strategy';
import { NovaPreset } from './core/config/theme.preset';
import { I18nService } from './core/services/i18n.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(() => inject(I18nService).initialize()),
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Every feature route is lazy, so the first visit to a page stalled while
    // its chunk downloaded — the blank flash between pages. Preloading starts
    // only once the app is stable, so it never competes with the first screen's
    // own API calls.
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([apiInterceptor])),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: NovaPreset,
        options: {
          prefix: 'p',
          darkModeSelector: '.p-dark',
          cssLayer: false,
        },
      },
      overlayAppendTo: 'body',
      ripple: true,
    }),
    MessageService,
    ConfirmationService,
    { provide: TitleStrategy, useClass: LocalizedTitleStrategy },
  ],
};
