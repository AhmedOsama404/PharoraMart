import { HttpContextToken } from '@angular/common/http';

/**
 * RFC 7807 failure body returned by the backend
 * (`application/problem+json`; see `ErrorCatalog` in
 * `D:\NovaBackend\src\PharoraMart.Api\Configuration`).
 *
 * - `code` is the stable, language-neutral switch clients localize from;
 * - `title` is the backend's own localized title (8 locales, Accept-Language);
 * - `detail` is an English diagnostic for logs/support, never shown raw;
 * - `errors` is the field → messages map for validation failures;
 * - `args` carries language-neutral values a localized message needs
 *   (e.g. `minOrderAmount`), so no client has to parse English text.
 */
export interface ProblemDetails {
  readonly title?: string;
  readonly status?: number;
  readonly code?: string;
  readonly detail?: string;
  readonly instance?: string;
  readonly traceId?: string;
  readonly errors?: Record<string, readonly string[]>;
  readonly args?: Record<string, unknown>;
}

/** Narrow an unknown error body to a ProblemDetails bag without throwing. */
export function asProblemDetails(value: unknown): ProblemDetails | null {
  if (value == null || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  const hasSignal =
    typeof body['code'] === 'string' ||
    typeof body['title'] === 'string' ||
    typeof body['detail'] === 'string' ||
    typeof body['status'] === 'number' ||
    typeof body['errors'] === 'object';
  return hasSignal ? (body as ProblemDetails) : null;
}

/**
 * Suppress the global error toast for one request so the caller can render
 * its own (contextual, inline) message instead of getting both.
 */
export const SILENT_ERROR_TOAST = new HttpContextToken<boolean>(() => false);
