import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiClientService } from '../api/api-client.service';
import { resolveMediaUrl } from '../../shared/utils/media-url.utils';

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
    // Banner media comes back as an API-relative path; resolve it here so a
    // block image is not fetched from the storefront origin and 404'd.
    return this.api.get<ContentBlock[]>('content').pipe(
      map((blocks) =>
        blocks.map((block) => ({ ...block, imageUrl: resolveMediaUrl(block.imageUrl) })),
      ),
    );
  }
}
