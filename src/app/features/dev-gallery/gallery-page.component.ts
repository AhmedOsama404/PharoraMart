import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { I18nService } from '../../core/services/i18n.service';
import { DataBoundaryComponent, type BoundaryState } from '../../shared/resilience/data-boundary.component';
import { ErrorStateComponent } from '../../shared/resilience/error-state.component';
import {
  ProductCardSkeletonComponent,
  ProductGridSkeletonComponent,
  SkeletonBlockComponent,
  SkeletonTextComponent,
  TableSkeletonComponent,
} from '../../shared/resilience/skeleton.component';

/**
 * Dev-only visual gallery (excluded from production builds by a file
 * replacement of gallery.routes.ts). Shows every state in light/dark,
 * LTR/RTL and desktop/mobile widths.
 */
@Component({
  selector: 'app-dev-gallery',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Button, DataBoundaryComponent, ErrorStateComponent,
    SkeletonBlockComponent, SkeletonTextComponent,
    ProductGridSkeletonComponent, TableSkeletonComponent,
  ],
  template: `
    <section class="g-wrap">
      <header class="g-head">
        <h1>Resilience gallery</h1>
        <div class="g-controls">
          <p-button label="Light / Dark" icon="pi pi-moon" (onClick)="toggleDark()" />
          <p-button label="LTR / RTL" icon="pi pi-arrow-right-arrow-left" (onClick)="toggleDir()" />
          <p-button label="Mobile / Desktop" icon="pi pi-mobile" (onClick)="toggleWidth()" />
        </div>
      </header>

      <div class="g-frame" [style.max-width]="mobile() ? '390px' : null">
        <h2>Primitives</h2>
        <div class="g-row">
          <app-skeleton width="8rem" height="1rem" />
          <app-skeleton width="3rem" height="3rem" [circle]="true" />
          <app-skeleton width="10rem" height="2.5rem" radius="0.6rem" />
        </div>
        <app-skeleton-text [lines]="3" />
        <h2>Product grid</h2>
        <app-product-grid-skeleton [count]="4" [columns]="2" />
        <h2>Table</h2>
        <app-table-skeleton [rows]="4" columns="2fr 3fr 1fr" [columnCount]="3" />

        <h2>Async boundary states</h2>
        @for (state of states; track state) {
          <div class="g-state">
            <h3>{{ state }}</h3>
            <app-data-boundary [state]="state" [error]="errorFor(state)" (retry)="retry(state)">
              <ng-template #skeleton>
                <app-skeleton-text [lines]="2" />
              </ng-template>
              <ng-template #content>
                <p class="g-content">Real content renders here.</p>
              </ng-template>
            </app-data-boundary>
          </div>
        }

        <h2>Error variants</h2>
        <div class="g-errors">
          @for (kind of kinds; track kind) {
            <app-error-state [kind]="kind" requestId="req-gallery-1234" [showHome]="false" (retry)="retry(kind)" />
          }
        </div>

        <h2>Slow hint (3 s)</h2>
        <app-data-boundary state="loading" [slowAfterMs]="0">
          <ng-template #skeleton><app-skeleton-text [lines]="2" /></ng-template>
        </app-data-boundary>
      </div>
    </section>
  `,
  styles: [`
    .g-wrap { padding: 1.5rem; background: var(--surface-ground); color: var(--text-primary); min-height: 100vh; }
    .g-head { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between; }
    .g-controls { display: flex; flex-wrap: wrap; gap: .5rem; }
    .g-frame { margin-top: 1rem; display: grid; gap: 1rem; }
    .g-row { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; }
    .g-state { display: grid; gap: .4rem; }
    .g-state h3 { margin: 0; font-size: .8rem; text-transform: uppercase; letter-spacing: .06em; color: var(--text-secondary); }
    .g-content { margin: 0; padding: .9rem; border: 1px solid var(--surface-border); border-radius: .7rem; }
    .g-errors { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
    h1, h2 { margin: 0; }
    h2 { margin-top: 1rem; font-size: 1.1rem; }
  `],
})
export class DevGalleryComponent {
  readonly states: BoundaryState[] = ['loading', 'success', 'empty', 'error', 'offline', 'stale', 'partial'];
  readonly kinds = ['network', 'server', 'timeout', 'rate_limited', 'not_found', 'forbidden', 'unknown'] as const;
  readonly mobile = signal(false);

  constructor(private readonly i18n: I18nService) {}

  toggleDark(): void {
    document.documentElement.classList.toggle('p-dark');
  }

  toggleDir(): void {
    const html = document.documentElement;
    const next = html.dir === 'rtl' ? 'ltr' : 'rtl';
    html.dir = next;
    this.i18n.setLang(next === 'rtl' ? 'ar' : 'en');
  }

  toggleWidth(): void {
    this.mobile.update((v) => !v);
  }

  errorFor(state: BoundaryState): unknown {
    return state === 'error'
      ? { kind: 'server', requestId: 'req-gallery-error' }
      : state === 'offline'
        ? { kind: 'offline' }
        : null;
  }

  retry(_state: unknown): void {
    /* gallery only */
  }
}
