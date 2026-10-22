import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/services/i18n.service';

@Component({
  selector: 'app-section-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './section-header.component.html',
  styleUrl: './section-header.component.scss',
})
export class SectionHeaderComponent {
  protected i18n = inject(I18nService);

  @Input() title = '';
  @Input() subtitle = '';
  /** Target of the "view all" link: an in-store path or an absolute URL. */
  @Input() link?: string;
  @Input() linkLabel = '';

  /** An absolute URL is not a route: it opens outside the storefront. */
  protected external(): boolean {
    return !!this.link && /^(https?:)?\/\//i.test(this.link);
  }

  /** A link always has a name, even when the CMS only set the target. */
  protected label(): string {
    return this.linkLabel || this.i18n.t('common.viewAll');
  }
}
