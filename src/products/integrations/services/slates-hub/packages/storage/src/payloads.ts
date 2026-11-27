import { invocationsBucketRecord, storage } from './storage';

export let getTriggerRawEventPayloadStorageKey = (rawEventId: string) =>
  `trigger-raw-events/${rawEventId}/payload`;

export let getTriggerEventPayloadStorageKey = (triggerEventId: string) =>
  `trigger-events/${triggerEventId}/payload`;

export let loadOffloadedTriggerEventPayload = async (
  storageKey: string
): Promise<SlatesHubPrismaJson.AnyRecord | null> => {
  try {
    let object = await storage.getObject(invocationsBucketRecord.bucket, storageKey);
    return JSON.parse(object.data.toString('utf-8'));
  } catch {
    return null;
  }
};

export let getWebhookEventRequestStorageKey = (webhookEventId: string) =>
  `webhook-events/${webhookEventId}/request`;

export let loadOffloadedWebhookEventRequest = async (
  storageKey: string
): Promise<SlatesHubPrismaJson.SlateWebhookEventRequest | null> => {
  try {
    let object = await storage.getObject(invocationsBucketRecord.bucket, storageKey);
    return JSON.parse(object.data.toString('utf-8'));
  } catch {
    return null;
  }
};
