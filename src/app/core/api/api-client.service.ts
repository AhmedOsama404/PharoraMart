import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SILENT_ERROR_TOAST } from './problem-details';

/**
 * Per-request switches. `silent` suppresses the global error toast so the
 * caller can render its own contextual, inline message (checkout coupon,
 * sign-in form, …) without a duplicate notification.
 */
export interface ApiRequestOptions {
  readonly silent?: boolean;
}

function options(silent: boolean | undefined, headers?: Record<string, string>) {
  const context = silent ? new HttpContext().set(SILENT_ERROR_TOAST, true) : undefined;
  return { headers, context };
}

/**
 * Centralized HTTP layer. Feature services must use this instead of
 * HttpClient directly, so base URL, headers and error mapping stay central.
 * The Bearer token is attached by `apiInterceptor`; per-request headers (e.g.
 * `Idempotency-Key`) pass through here.
 */
@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  constructor(private http: HttpClient) {}

  get<T>(
    path: string,
    params?: Record<string, string | number | boolean | string[] | null | undefined>,
    optionsIn?: ApiRequestOptions,
  ): Observable<T> {
    let httpParams = new HttpParams();
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v === null || v === undefined) continue;
      if (Array.isArray(v)) {
        // ASP.NET Core binds repeated keys (tags=a&tags=b); skip empties.
        for (const one of v) if (one !== '') httpParams = httpParams.append(k, one);
      } else {
        httpParams = httpParams.set(k, String(v));
      }
    }
    return this.http.get<T>(`${this.baseUrl}/${path.replace(/^\//, '')}`, {
      params: httpParams,
      ...options(optionsIn?.silent),
    });
  }

  post<T>(
    path: string,
    body: unknown,
    headers?: Record<string, string>,
    optionsIn?: ApiRequestOptions,
  ): Observable<T> {
    return this.http.post<T>(
      `${this.baseUrl}/${path.replace(/^\//, '')}`,
      body,
      options(optionsIn?.silent, headers),
    );
  }

  put<T>(
    path: string,
    body: unknown,
    headers?: Record<string, string>,
    optionsIn?: ApiRequestOptions,
  ): Observable<T> {
    return this.http.put<T>(
      `${this.baseUrl}/${path.replace(/^\//, '')}`,
      body,
      options(optionsIn?.silent, headers),
    );
  }

  delete<T>(
    path: string,
    headers?: Record<string, string>,
    optionsIn?: ApiRequestOptions,
  ): Observable<T> {
    return this.http.delete<T>(
      `${this.baseUrl}/${path.replace(/^\//, '')}`,
      options(optionsIn?.silent, headers),
    );
  }
}
