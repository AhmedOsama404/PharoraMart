import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Primitive block. Dimensions are explicit so skeletons reserve real space. */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="rs-skeleton"
      [class.rs-skeleton--circle]="circle"
      [style.width]="width"
      [style.height]="height"
      [style.border-radius]="circle ? '50%' : radius"
      aria-hidden="true"
    ></span>
  `,
})
export class SkeletonBlockComponent {
  @Input() width = '100%';
  @Input() height = '1rem';
  @Input() radius = '0.5rem';
  @Input() circle = false;
}

/** Paragraph skeleton with a stable last-line width. */
@Component({
  selector: 'app-skeleton-text',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonBlockComponent],
  template: `
    <div class="rs-skeleton-text" aria-hidden="true">
      @for (line of lineList; track $index) {
        <app-skeleton
          height="0.85rem"
          [width]="$last ? lastWidth : '100%'"
          radius="999px"
        />
      }
    </div>
  `,
})
export class SkeletonTextComponent {
  @Input() lines = 3;
  @Input() lastWidth = '62%';

  get lineList(): number[] {
    return Array.from({ length: Math.max(1, this.lines) }, (_, i) => i);
  }
}

/** Mirrors the real product-card dimensions (image + two text lines + price). */
@Component({
  selector: 'app-product-card-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonBlockComponent, SkeletonTextComponent],
  template: `
    <div class="rs-product-skeleton" aria-hidden="true">
      <app-skeleton height="13.5rem" radius="0.9rem" />
      <app-skeleton width="45%" height="0.7rem" radius="999px" />
      <app-skeleton-text [lines]="2" lastWidth="70%" />
      <div class="rs-row">
        <app-skeleton width="4.5rem" height="1.1rem" radius="999px" />
        <app-skeleton width="2.4rem" height="2rem" radius="0.6rem" />
      </div>
    </div>
  `,
})
export class ProductCardSkeletonComponent {}

/** Grid of product-card skeletons, matching the real responsive grid. */
@Component({
  selector: 'app-product-grid-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProductCardSkeletonComponent],
  template: `
    <div class="rs-grid" [style.--rs-cols]="columns" aria-hidden="true">
      @for (i of items; track i) {
        <app-product-card-skeleton />
      }
    </div>
  `,
})
export class ProductGridSkeletonComponent {
  @Input() count = 8;
  @Input() columns = 4;

  get items(): number[] {
    return Array.from({ length: Math.max(1, this.count) }, (_, i) => i);
  }
}

/**
 * Table skeleton whose column widths match the real table. `widths` accepts
 * the same track list used by the real `<colgroup>` (e.g. `2fr 3fr 1fr`).
 */
@Component({
  selector: 'app-table-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonBlockComponent],
  template: `
    <div class="rs-table" role="presentation" aria-hidden="true">
      @for (row of rowList; track row) {
        <div class="rs-table__row" [style.grid-template-columns]="columns">
          @for (cell of cells; track cell) {
            <app-skeleton height="0.9rem" [width]="cellWidth(cell)" radius="999px" />
          }
        </div>
      }
    </div>
  `,
})
export class TableSkeletonComponent {
  @Input() rows = 6;
  @Input() columns = '2fr 3fr 1fr 1fr';
  @Input() columnCount = 4;

  get rowList(): number[] {
    return Array.from({ length: Math.max(1, this.rows) }, (_, i) => i);
  }

  get cells(): number[] {
    return Array.from({ length: Math.max(1, this.columnCount) }, (_, i) => i);
  }

  cellWidth(index: number): string {
    return index === 0 ? '72%' : index % 2 === 0 ? '48%' : '64%';
  }
}
