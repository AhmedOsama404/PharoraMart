import type { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const AUTH_ROUTES: Routes = [
  { path: 'login', loadComponent: () => import('./login-page.component').then((m) => m.LoginPageComponent), data: { titleKey: 'meta.login' } },
  { path: 'register', loadComponent: () => import('./register-page.component').then((m) => m.RegisterPageComponent), data: { titleKey: 'meta.register' } },
  { path: 'forgot', loadComponent: () => import('./forgot-page.component').then((m) => m.ForgotPageComponent), data: { titleKey: 'meta.forgot' } },
  { path: 'profile', loadComponent: () => import('./profile-page.component').then((m) => m.ProfilePageComponent), canActivate: [authGuard], data: { titleKey: 'meta.profile' } },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
];
