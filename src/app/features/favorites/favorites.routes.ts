import type { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const FAVORITES_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./favorites-page.component').then((m) => m.FavoritesPageComponent), canActivate: [authGuard], data: { titleKey: 'meta.favorites' } },
];
