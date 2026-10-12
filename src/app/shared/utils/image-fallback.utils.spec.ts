import { handleImgError } from './image-fallback.utils';

function makeImg(): HTMLImageElement {
  const el = document.createElement('img');
  document.body.appendChild(el);
  return el;
}

describe('image-fallback.utils', () => {
  it('swaps a broken image to the fallback seed exactly once', () => {
    const el = makeImg();
    el.src = 'https://images.unsplash.com/broken';
    handleImgError({ target: el } as unknown as Event, 'demo-seed');
    expect(el.src).toContain('picsum.photos/seed/demo-seed');
    expect(el.classList.contains('img-gone')).toBeFalse();
    el.remove();
  });

  it('hides the image (revealing the framed placeholder) when the fallback fails too', () => {
    const el = makeImg();
    el.src = 'https://images.unsplash.com/broken';
    handleImgError({ target: el } as unknown as Event, 'demo-seed');
    handleImgError({ target: el } as unknown as Event, 'demo-seed');
    expect(el.classList.contains('img-gone')).toBeTrue();
    // Still the single fallback source — no error-loop source swapping.
    expect(el.src).toContain('picsum.photos/seed/demo-seed');
    el.remove();
  });

  it('ignores non-image targets safely', () => {
    expect(() => handleImgError({ target: document.createElement('div') } as unknown as Event, 'x')).not.toThrow();
    expect(() => handleImgError({ target: null } as unknown as Event, 'x')).not.toThrow();
  });
});
