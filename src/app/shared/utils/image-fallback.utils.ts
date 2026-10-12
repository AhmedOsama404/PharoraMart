/**
 * Shared broken-image handling for every product/category image in the
 * storefront. Two-stage recovery so a dead CDN never leaves a collapsed
 * sliver or a raw broken-image icon:
 *
 * 1st error → swap to a stable `picsum.photos` seed (once only);
 * 2nd error → mark the image `img-gone` (CSS hides it, revealing the
 * `.img-frame` placeholder behind it; unframed usages keep their reserved
 * box instead of collapsing).
 *
 * A single implementation (previously copy-pasted per component, one copy
 * without even the once-guard).
 */
export function handleImgError(ev: Event, seed: string): void {
  const el = ev.target as HTMLImageElement | null;
  if (!el || el.tagName !== 'IMG') return;
  if (!el.dataset['fb']) {
    el.dataset['fb'] = '1';
    el.src = `https://picsum.photos/seed/${seed}/900/675`;
    return;
  }
  el.classList.add('img-gone');
}
