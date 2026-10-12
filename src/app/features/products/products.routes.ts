import type { Routes } from '@angular/router';

export const PRODUCTS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./catalog-page.component').then((m) => m.CatalogPageComponent), data: { titleKey: 'meta.catalog' } },
  // No titleKey here: the details page sets its own title (product name) on load.
  { path: ':id', loadComponent: () => import('./product-detail-page.component').then((m) => m.ProductDetailPageComponent) },
];
