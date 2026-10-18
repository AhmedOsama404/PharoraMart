import { resolveMediaUrl } from './media-url.utils';
import { environment } from '../../../environments/environment';

// The API serves /media/... from its own origin, so binding those paths from the
// storefront origin 404s (broken-image icon). This pins the single resolution
// boundary shared by catalog images and site-content logos.

const origin = new URL(environment.apiBaseUrl).origin;

describe('resolveMediaUrl', () => {
  it('resolves server-relative media paths against the API origin', () => {
    expect(resolveMediaUrl('/media/site-content/pharora-logo.svg')).toBe(
      `${origin}/media/site-content/pharora-logo.svg`,
    );
  });

  it('adds a leading slash for bare relative paths', () => {
    expect(resolveMediaUrl('media/x.svg')).toBe(`${origin}/media/x.svg`);
  });

  it('passes absolute, protocol-relative, data: and blob: URLs through', () => {
    expect(resolveMediaUrl('https://cdn.example.com/a.svg')).toBe('https://cdn.example.com/a.svg');
    expect(resolveMediaUrl('http://cdn.example.com/a.svg')).toBe('http://cdn.example.com/a.svg');
    expect(resolveMediaUrl('//cdn.example.com/a.svg')).toBe('//cdn.example.com/a.svg');
    expect(resolveMediaUrl('data:image/svg+xml;base64,AAA')).toBe('data:image/svg+xml;base64,AAA');
    expect(resolveMediaUrl('blob:http://localhost/abc')).toBe('blob:http://localhost/abc');
  });

  it('degrades empty and nullish input to an empty string', () => {
    expect(resolveMediaUrl('')).toBe('');
    expect(resolveMediaUrl('   ')).toBe('');
    expect(resolveMediaUrl(null)).toBe('');
    expect(resolveMediaUrl(undefined)).toBe('');
  });
});
