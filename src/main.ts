import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

// Production must never silently run on fake data: fail fast instead of
// showing mock products, mock checkout success, or mock order history.
if (environment.production && environment.useMockApi) {
  throw new Error('pharora: production build must not enable mock API mode.');
}

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
