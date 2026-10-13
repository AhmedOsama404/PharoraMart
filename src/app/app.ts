import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AccountSyncService } from './core/services/account-sync.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  // Intentionally inline (project convention): the root shell is a single
  // router outlet with no markup or styling of its own. Every real component
  // uses external .html/.scss files (see Stage 3 file separation).
  template: `<router-outlet />`,
  styles: [],
})
export class App {
  // Eager instantiation: account sync effects must run for the whole session.
  constructor(private sync: AccountSyncService) {}
}
