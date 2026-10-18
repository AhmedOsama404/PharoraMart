/**
 * Shared broken-image handling for every product/category image in the
 * storefront. A failed source is hidden once, revealing the local framed
 * placeholder without a second network request:
 *
 * 1st error → mark the image `img-gone` (CSS hides it, revealing the
 * `.img-frame` placeholder behind it; unframed usages keep their reserved
 * box instead of collapsing).
 *
 * A single implementation (previously copy-pasted per component, one copy
 * without even the once-guard).
 */
export function handleImgError(ev: Event, _seed: string): void {
  const el = ev.target as HTMLImageElement | null;
  if (!el || el.tagName !== 'IMG') return;
  if (el.dataset['fb']) return;
  el.dataset['fb'] = '1';
  el.classList.add('img-gone');
}
