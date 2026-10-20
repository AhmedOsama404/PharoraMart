import type { Routes } from '@angular/router';

/** Development-only gallery. Replaced by gallery.routes.prod.ts in production. */
export const GALLERY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./gallery-page.component').then((m) => m.DevGalleryComponent),
  },
];
