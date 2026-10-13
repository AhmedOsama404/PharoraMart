import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'novamart.favorites.v1';

// Guest favorites persist locally until an account-based sync API is
// connected. Corrupt or foreign payloads reset to empty, never crash.
function load(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((x): x is string => typeof x === 'string'))];
  } catch {
    return [];
  }
}

@Injectable({ providedIn: 'root' })
export class FavoritesStore {
  readonly ids = signal<string[]>(load());
  readonly count = computed(() => this.ids().length);

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.ids()));
    } catch {
      /* ignore */
    }
  }

  has(productId: string): boolean {
    return this.ids().includes(productId);
  }

  /** Returns true if now a favorite (idempotent). */
  add(productId: string): boolean {
    if (this.has(productId)) return true;
    this.ids.update((ids) => [...ids, productId]);
    this.persist();
    return true;
  }

  remove(productId: string): void {
    if (!this.has(productId)) return;
    this.ids.update((ids) => ids.filter((id) => id !== productId));
    this.persist();
  }

  toggle(productId: string): boolean {
    if (this.has(productId)) {
      this.remove(productId);
      return false;
    }
    this.add(productId);
    return true;
  }

  clear(): void {
    this.ids.set([]);
    this.persist();
  }

  /** Replaces local ids (server pull). */
  replaceAll(ids: string[]): void {
    this.ids.set([...new Set((ids ?? []).filter((x): x is string => typeof x === 'string'))]);
    this.persist();
  }
}
