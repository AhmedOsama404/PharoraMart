import type { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const AUTH_ROUTES: Routes = [
  { path: 'login', loadComponent: () => import('./login-page.component').then((m) => m.LoginPageComponent), data: { titleKey: 'meta.login' } },
  { path: 'register', loadComponent: () => import('./register-page.component').then((m) => m.RegisterPageComponent), data: { titleKey: 'meta.register' } },
  { path: 'forgot', loadComponent: () => import('./forgot-page.component').then((m) => m.ForgotPageComponent), data: { titleKey: 'meta.forgot' } },
  { path: 'reset-password', loadComponent: () => import('./reset-password-page.component').then((m) => m.ResetPasswordPageComponent), data: { titleKey: 'meta.resetPassword' } },
  { path: 'verify-email', loadComponent: () => import('./verify-email-page.component').then((m) => m.VerifyEmailPageComponent), data: { titleKey: 'meta.verifyEmail' } },
  { path: 'change-password', loadComponent: () => import('./change-password-page.component').then((m) => m.ChangePasswordPageComponent), canActivate: [authGuard], data: { titleKey: 'meta.changePassword' } },
  { path: 'profile', loadComponent: () => import('./profile-page.component').then((m) => m.ProfilePageComponent), canActivate: [authGuard], data: { titleKey: 'meta.profile' } },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
];
