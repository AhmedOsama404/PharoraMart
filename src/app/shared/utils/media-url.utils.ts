import { environment } from '../../../environments/environment';

/**
 * The API returns media paths relative to its own origin
 * (`/media/yyyy/MM/key.ext`, see LocalMediaStorage). Binding them directly from
 * the storefront origin 404s and silently swaps an image for a broken-image
 * icon, so resolve them against the API origin here — one boundary, every
 * image (catalog, category and site-content logos), no template changes.
 * Absolute (http/https, protocol-relative), `data:` and `blob:` URLs pass
 * through untouched; empty input stays empty.
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  const value = (url ?? '').trim();
  if (!value) return '';
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) return value;
  try {
    const origin = new URL(environment.apiBaseUrl).origin;
    return origin + (value.startsWith('/') ? value : `/${value}`);
  } catch {
    return value;
  }
}
