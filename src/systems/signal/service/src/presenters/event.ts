import type { Event, Sender } from '../../prisma/generated/client';
import { env } from '../env';
import { storageKey } from '../lib/storageKey';
import { storage } from '../storage';
import { senderPresenter } from './sender';

export let eventPresenter = async (
  event: Event & {
    sender: Sender;
  },
  { includePayload }: { includePayload: boolean }
) => {
  let payload: { body: string; headers: [string, string][] } | null = null;

  if (includePayload) {
    try {
      if (event.payloadJson) {
        payload = {
          body: event.payloadJson,
          headers: event.headers
        };
      } else {
        let payloadRaw = await storage.getObject(
          env.storage.LOGS_BUCKET_NAME,
          storageKey.event(event)
        );
        let data = JSON.parse(payloadRaw.data.toString('utf-8'));

        payload = {
          body: data.body,
          headers: data.headers
        };
      }
    } catch (err) {
      console.warn(`Failed to parse payload for event ${event.id}:`, err);
    }
  }

  return {
    object: 'signal#event',

    id: event.id,
    type: event.eventType,
    topics: event.topics,
    status: event.status,

    destinationCount:
      event.deliveryDestinationCount < 0 ? null : event.deliveryDestinationCount,
    successCount: event.deliverySuccessCount,
    failureCount: event.deliveryFailureCount,

    request: payload
      ? {
          body: payload.body,
          headers: payload.headers
            ? payload.headers.map(([key, value]) => ({ key, value }))
            : null
        }
      : null,

    sender: senderPresenter(event.sender),

    createdAt: event.createdAt,
    updatedAt: event.updatedAt
  };
};
