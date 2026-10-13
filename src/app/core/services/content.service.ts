import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiClientService } from '../api/api-client.service';

export interface ContentBlock {
  key: string;
  title: string;
  titles?: Record<string, string> | null;
  body: string;
  bodies?: Record<string, string> | null;
  imageUrl?: string | null;
  linkUrl?: string | null;
  sortOrder: number;
  isPublished: boolean;
  updatedAt: string;
}

/**
 * Published CMS content. Mock mode has no CMS (empty list, existing static
 * homepage stays); live mode renders dashboard-published blocks.
 */
@Injectable({ providedIn: 'root' })
export class ContentService {
  constructor(private api: ApiClientService) {}

  published(): Observable<ContentBlock[]> {
    if (environment.useMockApi) return of([]);
    return this.api.get<ContentBlock[]>('content');
  }
}
