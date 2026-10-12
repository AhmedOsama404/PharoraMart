import type { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const CHECKOUT_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./checkout-page.component').then((m) => m.CheckoutPageComponent), canActivate: [authGuard], data: { titleKey: 'meta.checkout' } },
  { path: 'confirmation/:id', loadComponent: () => import('./confirmation-page.component').then((m) => m.ConfirmationPageComponent), canActivate: [authGuard], data: { titleKey: 'meta.confirmation' } },
];
