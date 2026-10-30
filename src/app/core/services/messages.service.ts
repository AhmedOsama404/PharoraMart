import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from '../api/api-client.service';

/** Backend `CustomerMessageReferenceDto` (camelCase JSON). */
export interface MessageReference {
  id: string;
  createdAt: string;
}

/** Backend `SubmitCustomerMessageDto` (camelCase JSON). */
export interface CustomerMessagePayload {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  body: string;
}

/**
 * Submits a customer message to the backend inbox (`POST api/v1/messages`).
 *
 * The request is silent: the contact form renders its own inline success and
 * error states, so a global toast would duplicate the feedback. The caller
 * owns the busy flag to keep the submit button disabled while the request is
 * in flight (duplicate-submit protection).
 */
@Injectable({ providedIn: 'root' })
export class MessagesService {
  private readonly api = inject(ApiClientService);

  submit(payload: CustomerMessagePayload): Observable<MessageReference> {
    return this.api.post<MessageReference>('messages', payload, undefined, { silent: true });
  }
}
