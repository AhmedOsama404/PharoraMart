import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { Button } from 'primeng/button';
import { I18nService } from '../../core/services/i18n.service';

@Component({
  selector: 'app-qty-selector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  templateUrl: './qty-selector.component.html',
  styleUrl: './qty-selector.component.scss',
})
export class QtySelectorComponent {
  protected i18n = inject(I18nService);

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
