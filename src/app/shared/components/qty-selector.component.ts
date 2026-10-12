import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Button } from 'primeng/button';

@Component({
  selector: 'app-qty-selector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  templateUrl: './qty-selector.component.html',
  styleUrl: './qty-selector.component.scss',
})
export class QtySelectorComponent {
  @Input() qty = 1;
  @Input() min = 1;
  // Callers pass the live stock level so the user can never exceed it.
  @Input() max = 99;
  @Input() ariaLabel = 'Quantity';
  @Output() qtyChange = new EventEmitter<number>();

  protected dec(): void {
    this.qtyChange.emit(Math.max(this.min, this.qty - 1));
  }

  protected inc(): void {
    this.qtyChange.emit(Math.min(this.max, this.qty + 1));
  }
}
