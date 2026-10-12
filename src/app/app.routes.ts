import type { Routes } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      { path: '', loadChildren: () => import('./features/home/home.routes').then((m) => m.HOME_ROUTES) },
      { path: 'products', loadChildren: () => import('./features/products/products.routes').then((m) => m.PRODUCTS_ROUTES) },
      { path: 'cart', loadChildren: () => import('./features/cart/cart.routes').then((m) => m.CART_ROUTES) },
      { path: 'favorites', loadChildren: () => import('./features/favorites/favorites.routes').then((m) => m.FAVORITES_ROUTES) },
      { path: 'auth', loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES) },
      { path: 'checkout', loadChildren: () => import('./features/checkout/checkout.routes').then((m) => m.CHECKOUT_ROUTES) },
      { path: 'orders', loadChildren: () => import('./features/orders/orders.routes').then((m) => m.ORDERS_ROUTES) },
      { path: 'not-found', loadComponent: () => import('./features/static/not-found-page.component').then((m) => m.NotFoundPageComponent), data: { titleKey: 'meta.notFound' } },
    ],
  },
  { path: '**', redirectTo: 'not-found' },
];
