import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Button } from 'primeng/button';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  @Input() icon = 'pi-inbox';
  @Input() title = '';
  @Input() subtitle = '';
  @Input() actionLabel = '';
  // Emitted when the optional action button is clicked (retry, browse, …).
  @Output() actionClick = new EventEmitter<void>();
}
