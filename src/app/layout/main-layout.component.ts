import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { HeaderComponent } from './header.component';
import { FooterComponent } from './footer.component';
import { StorefrontConfigService } from '../core/services/storefront-config.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Toast, ConfirmDialog, HeaderComponent, FooterComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent implements OnInit {
  protected storefront = inject(StorefrontConfigService);

  ngOnInit(): void {
    // Published storefront config (announcements, footer links, theme).
    // Safe no-op in mock mode and on failure: built-in defaults apply.
    this.storefront.load();
  }
}
