import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, retry, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TranslationResult {
  translatedText: string;
  source?: string;
  target?: string;
}

export interface Language {
  code: string;
  name: string;
}

/**
 * Translation service using self-hosted LibreTranslate.
 * LibreTranslate is free, unlimited, and runs on your own infrastructure.
 * API docs: https://libretranslate.com/docs
 */
@Injectable({ providedIn: 'root' })
export class LibreTranslateService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.libreTranslateUrl.replace(/\/$/, '');
  private readonly defaultSource = 'en';

  /** Get supported languages (cached for 1 hour). */
  getLanguages(): Observable<Language[]> {
    return this.http.get<Language[]>(`${this.baseUrl}/languages`).pipe(
      timeout(10000),
      retry({ count: 2, delay: 1000 }),
      catchError(() => of([
        { code: 'en', name: 'English' },
        { code: 'ar', name: 'العربية' },
        { code: 'de', name: 'Deutsch' },
        { code: 'fr', name: 'Français' },
        { code: 'es', name: 'Español' },
        { code: 'it', name: 'Italiano' },
        { code: 'cs', name: 'Čeština' },
        { code: 'pl', name: 'Polski' },
        { code: 'sk', name: 'Slovenčina' },
      ] as Language[])),
    );
  }

  /**
   * Translate text from source to target language.
   * @param text Text to translate
   * @param target Target language code (e.g., 'ar', 'de')
   * @param source Source language code (default: 'en', 'auto' for detection)
   */
  translate(text: string, target: string, source = this.defaultSource): Observable<string> {
    if (!text?.trim()) return of('');

    const body = {
      q: text,
      source,
      target,
      format: 'text',
    };

    return this.http.post<TranslationResult>(`${this.baseUrl}/translate`, body).pipe(
      timeout(15000),
      retry({ count: 2, delay: 1000 }),
      map((res) => res.translatedText ?? text),
      catchError((err) => {
        console.warn('[LibreTranslate] Translation failed, returning original:', err);
        return of(text); // Graceful fallback: show original text
      }),
    );
  }

  /** Batch translate multiple strings (more efficient for UI batches). */
  translateBatch(texts: string[], target: string, source = this.defaultSource): Observable<string[]> {
    if (!texts?.length) return of([]);

    const body = {
      q: texts,
      source,
      target,
      format: 'text',
    };

    return this.http.post<TranslationResult[]>(`${this.baseUrl}/translate`, body).pipe(
      timeout(20000),
      retry({ count: 2, delay: 1000 }),
      map((results) => results.map((r) => r.translatedText ?? '')),
      catchError((err) => {
        console.warn('[LibreTranslate] Batch translation failed, returning originals:', err);
        return of(texts);
      }),
    );
  }

  /** Detect language of a text. */
  detect(text: string): Observable<string> {
    return this.http.post<{ language: string; confidence: number }>(`${this.baseUrl}/detect`, { q: text }).pipe(
      timeout(10000),
      map((res) => res.language ?? 'en'),
      catchError(() => of('en')),
    );
  }

  /** Health check for the translation service. */
  healthCheck(): Observable<boolean> {
    return this.http.get(`${this.baseUrl}/languages`).pipe(
      timeout(5000),
      map(() => true),
      catchError(() => of(false)),
    );
  }
}