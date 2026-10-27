import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ProductCardComponent } from './product-card.component';
import { MOCK_PRODUCTS } from '../../data-access/mock-data';
import { hermeticApi } from '../../../testing/hermetic-api';

const P = MOCK_PRODUCTS[0];

describe('ProductCardComponent', () => {
  let fixture: ComponentFixture<ProductCardComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideNoopAnimations(), ...hermeticApi()],
    }).compileComponents();
    fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentInstance.product = P;
    fixture.detectChanges();
  });

  it('renders the framed image placeholder behind the product image', () => {
    expect(fixture.nativeElement.querySelector('.media .media-link.img-frame > img')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.media .media-link.img-frame > .img-fallback')).toBeTruthy();
  });

  it('renders name, price and stock state', () => {
    const text = (fixture.nativeElement as HTMLElement).innerText.replace(/\s+/g, ' ');
    expect(text).toContain(P.name);
    expect(fixture.nativeElement.querySelector('.fav-btn')).toBeTruthy();
  });

  it('shows the locale-formatted rating and review count', () => {
    const rating = fixture.nativeElement.querySelector('.rating') as HTMLElement;
    expect(rating.getAttribute('aria-label')).toBe('Rated 4.8 out of 5 · 1,830 reviews');
    expect(rating.querySelectorAll('.stars .pi').length).toBe(5);
    expect(rating.innerText.replace(/\s+/g, ' ')).toContain('(1,830)');
  });

  it('emits add and favToggle exactly once per click', () => {
    const comp = fixture.componentInstance;
    let adds = 0;
    let favs = 0;
    comp.add.subscribe(() => adds++);
    comp.favToggle.subscribe(() => favs++);
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.cart-action-row > p-button button');
    button.click();
    expect(adds).toBe(1);
    expect(favs).toBe(0);
  });
});
