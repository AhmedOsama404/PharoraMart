import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Pharora brand mark: a lotus bloom (natural beauty) over two wave arcs
 * (the Nile / Red Sea — effortless hotel delivery). Fixed ivory/gold artwork
 * on a botanical-green badge, so one asset works on light and dark surfaces.
 * Decorative inside labelled links; the link itself carries the accessible name.
 */
@Component({
  selector: 'app-brand-logo',
  standalone: true,
  templateUrl: './brand-logo.component.html',
  styleUrl: './brand-logo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandLogoComponent {}
