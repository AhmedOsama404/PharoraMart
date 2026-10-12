import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Centralized HTTP layer. Feature services must use this instead of
 * HttpClient directly, so base URL, headers and error mapping stay central.
 * Currently unused in mock mode (useMockApi=true); kept ready for Phase 2.
 */
@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  constructor(private http: HttpClient) {}

  get<T>(path: string, params?: Record<string, string | number | boolean>): Observable<T> {
    let httpParams = new HttpParams();
    for (const [k, v] of Object.entries(params ?? {})) httpParams = httpParams.set(k, String(v));
    return this.http.get<T>(`${this.baseUrl}/${path.replace(/^\//, '')}`, { params: httpParams });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}/${path.replace(/^\//, '')}`, body);
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}/${path.replace(/^\//, '')}`, body);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}/${path.replace(/^\//, '')}`);
  }
}
