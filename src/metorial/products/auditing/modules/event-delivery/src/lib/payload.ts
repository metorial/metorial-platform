import { db as integrationsDb } from '@metorial-subspace/db';
import type { EventDeliveryAttempt, SystemEvent } from '@metorial/db';
import {
  getChatEventPayloadsBucketName,
  getDeliveryPayloadsBucketName,
  getEventPayloadsBucketName,
  getStorage
} from '../storage';

let readJsonObject = async (bucket: string, key: string) => {
  let object = await getStorage().getObject(bucket, key);
  return JSON.parse(object.data.toString('utf-8'));
};

// A payload starts out inline on the row and is moved into object storage by a flush cron, so it
// may live in either place depending on the row's age.
export let resolveSystemEventDeliveryPayload = async (
  event: Pick<SystemEvent, 'source' | 'chatEventId' | 'payloadJson' | 'payloadStorageKey'>
): Promise<Record<string, any> | null> => {
  if (event.source == 'chat') {
    if (!event.chatEventId) return null;

    let chatEvent = await integrationsDb.chatEvent.findUnique({
      where: { id: event.chatEventId },
      select: { payload: true, payloadStorageKey: true }
    });
    if (!chatEvent) return null;

    if (chatEvent.payload) return chatEvent.payload as Record<string, any>;
    if (!chatEvent.payloadStorageKey) return null;

    return readJsonObject(getChatEventPayloadsBucketName(), chatEvent.payloadStorageKey);
  }

  if (event.payloadJson) return event.payloadJson as Record<string, any>;
  if (!event.payloadStorageKey) return null;

  return readJsonObject(getEventPayloadsBucketName(), event.payloadStorageKey);
};

export let resolveAttemptDetails = async (
  attempt: Pick<EventDeliveryAttempt, 'detailsJson' | 'detailsStorageKey'>
): Promise<PrismaJson.EventDeliveryAttemptDetails | null> => {
  if (attempt.detailsJson) return attempt.detailsJson;
  if (!attempt.detailsStorageKey) return null;

  try {
    return await readJsonObject(getDeliveryPayloadsBucketName(), attempt.detailsStorageKey);
  } catch (error) {
    console.error('[EventDelivery] Failed to read attempt details from object storage', error);
    return null;
  }
};

export let deleteAttemptDetails = async (attempt: { detailsStorageKey: string | null }) => {
  if (!attempt.detailsStorageKey) return;

  await getStorage().deleteObject(getDeliveryPayloadsBucketName(), attempt.detailsStorageKey);
};
