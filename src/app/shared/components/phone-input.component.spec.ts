import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { PhoneInputComponent } from './phone-input.component';
import { I18nService } from '../../core/services/i18n.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, PhoneInputComponent],
  template: `<app-phone-input [formControl]="control" />`,
})
class HostComponent {
  control = new FormControl('', { nonNullable: true });
}

describe('PhoneInputComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  function numberInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input.phone__number') as HTMLInputElement;
  }

  it('emits a normalized E.164 value while typing', () => {
    const input = numberInput();
    input.value = '1001234567';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(host.control.value).toBe('+201001234567');
  });

  it('reopens an incoming E.164 value on its own country', () => {
    host.control.setValue('+14155550132');
    fixture.detectChanges();
    // The national digits are preserved (display may add grouping).
    expect(numberInput().value.replace(/\D/g, '')).toBe('4155550132');
  });


  it('follows the selected language direction while keeping the number field LTR', async () => {
    const i18n = TestBed.inject(I18nService);
    await i18n.setLang('ar');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.phone').getAttribute('dir')).toBe('rtl');
    expect(numberInput().getAttribute('dir')).toBe('ltr');

    await i18n.setLang('en');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.phone').getAttribute('dir')).toBe('ltr');
  });
  it('renders country options the first time the picker opens', async () => {
    const trigger = fixture.nativeElement.querySelector('.phone__country .p-select-dropdown') as HTMLElement;
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    fixture.detectChanges();

    expect(document.body.querySelectorAll('.phone-country-panel .p-select-option').length).toBeGreaterThan(0);
  });
  it('clears the control when the number is emptied', () => {
    host.control.setValue('+201001234567');
    fixture.detectChanges();
    const input = numberInput();
    input.value = '';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(host.control.value).toBe('');
  });
});
