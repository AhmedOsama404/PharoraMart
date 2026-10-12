import { Injectable } from '@angular/core';

const KEY = 'novamart.recently-viewed.v1';
const MAX = 8;

@Injectable({ providedIn: 'root' })
export class RecentlyViewedService {
  push(productId: string): void {
    try {
      const raw = localStorage.getItem(KEY);
      const arr: string[] = raw ? (JSON.parse(raw) as string[]) : [];
      const next = [productId, ...arr.filter((id) => id !== productId)].slice(0, MAX);
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  list(): string[] {
    try {
      const raw = localStorage.getItem(KEY);
      const arr: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
}
