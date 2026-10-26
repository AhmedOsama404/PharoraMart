/**
 * A stable proof of the consent text a customer saw.
 *
 * The backend stores this hash with the consent record, so "what was agreed"
 * stays provable long after the page is gone. It is a SHA-256 of the exact
 * text that was displayed — never the text itself, which would put the
 * customer's agreement into a column meant for a fingerprint.
 *
 * The hash is computed with the Web Crypto API, which is available in every
 * secure context (and on `http://localhost`). When it is not available the
 * result is null: the order is still placed, and the consent record simply
 * carries no proof. Sending a wrong or empty value would be worse than
 * sending none.
 */
export async function consentTextHash(text: string): Promise<string | null> {
  const value = (text ?? '').trim();
  if (!value) return null;

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;

  try {
    const bytes = new TextEncoder().encode(value);
    const digest = await subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}
