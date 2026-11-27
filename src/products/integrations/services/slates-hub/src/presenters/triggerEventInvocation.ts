import type { SlateAttachment, SlateInvocation } from '../../prisma/generated/client';
import { slateInvocationLitePresenter } from './slateInvocation';

type InvocationWithStoredAttachments = SlateInvocation & {
  slateInvocationAttachment?: Array<{
    attachments: SlateAttachment;
  }>;
};

export let triggerEventInvocationPresenter = async (entry: {
  type: 'map_event' | 'webhook_handle';
  id: string;
  status: string;
  attempt: number;
  errorCode: string | null;
  errorMessage: string | null;
  triggerEventIds: string[];
  webhookEventId: string | null;
  invocation: InvocationWithStoredAttachments;
  createdAt: Date;
}) => ({
  object: 'trigger_event.invocation',

  id: entry.id,
  type: entry.type,
  status: entry.status,
  attempt: entry.attempt,

  triggerEventIds: entry.triggerEventIds,
  webhookEventId: entry.webhookEventId,

  error: entry.errorCode
    ? { code: entry.errorCode, message: entry.errorMessage ?? entry.errorCode }
    : null,

  invocation: await slateInvocationLitePresenter(entry.invocation),

  createdAt: entry.createdAt
});
