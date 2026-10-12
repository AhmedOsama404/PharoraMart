import type { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const ORDERS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./orders-page.component').then((m) => m.OrdersPageComponent), canActivate: [authGuard], data: { titleKey: 'meta.orders' } },
  { path: ':id', loadComponent: () => import('./order-detail-page.component').then((m) => m.OrderDetailPageComponent), canActivate: [authGuard], data: { titleKey: 'meta.orderDetail' } },
];
