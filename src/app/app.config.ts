import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, TitleStrategy } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';

import { routes } from './app.routes';
import { apiInterceptor } from './core/api/api.interceptor';
import { LocalizedTitleStrategy } from './core/services/title.strategy';
import { NovaPreset } from './core/config/theme.preset';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
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
