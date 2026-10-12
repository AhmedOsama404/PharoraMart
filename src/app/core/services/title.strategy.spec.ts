import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { I18nService } from './i18n.service';
import { LocalizedTitleStrategy } from './title.strategy';

@Component({ selector: 'app-dummy-a', standalone: true, template: 'a' })
class DummyAComponent {}

@Component({ selector: 'app-dummy-b', standalone: true, template: 'b' })
class DummyBComponent {}

describe('LocalizedTitleStrategy', () => {
  let harness: RouterTestingHarness;
  let i18n: I18nService;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'a', component: DummyAComponent, data: { titleKey: 'meta.cart' } },
          { path: 'b', component: DummyBComponent },
        ]),
        { provide: TitleStrategy, useClass: LocalizedTitleStrategy },
      ],
    });
    i18n = TestBed.inject(I18nService);
    harness = await RouterTestingHarness.create();
  });

  it('sets the translated title on navigation', async () => {
    await harness.navigateByUrl('/a', DummyAComponent);
    expect(document.title).toBe('Shopping cart — NovaMart');
  });

  it('re-applies the title on language switch without navigation', async () => {
    await harness.navigateByUrl('/a', DummyAComponent);
    i18n.setLang('de');
    await harness.fixture.whenStable();
    expect(document.title).toBe('Warenkorb — NovaMart');
  });

  it('falls back to the app name for routes without a titleKey', async () => {
    await harness.navigateByUrl('/b', DummyBComponent);
    expect(document.title).toBe('NovaMart');
  });
});
