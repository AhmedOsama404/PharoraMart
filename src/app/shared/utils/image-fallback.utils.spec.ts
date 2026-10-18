import { handleImgError } from './image-fallback.utils';

function makeImg(): HTMLImageElement {
  const el = document.createElement('img');
  document.body.appendChild(el);
  return el;
}

describe('image-fallback.utils', () => {
  it('shows the local placeholder after the real image errors without a retry request', () => {
    const el = makeImg();
    el.src = 'https://images.unsplash.com/broken';
    const failedUrl = el.src;
    handleImgError({ target: el } as unknown as Event, 'demo-seed');
    expect(el.src).toBe(failedUrl);
    expect(el.classList.contains('img-gone')).toBeTrue();
    el.remove();
  });

  it('handles repeated error events once and keeps the original source', () => {
    const el = makeImg();
    el.src = 'https://images.unsplash.com/broken';
    const failedUrl = el.src;
    handleImgError({ target: el } as unknown as Event, 'demo-seed');
    handleImgError({ target: el } as unknown as Event, 'demo-seed');
    expect(el.classList.contains('img-gone')).toBeTrue();
    expect(el.src).toBe(failedUrl);
    el.remove();
  });

  it('ignores non-image targets safely', () => {
    expect(() => handleImgError({ target: document.createElement('div') } as unknown as Event, 'x')).not.toThrow();
    expect(() => handleImgError({ target: null } as unknown as Event, 'x')).not.toThrow();
  });
});
