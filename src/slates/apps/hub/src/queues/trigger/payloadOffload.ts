import { createQueue } from '@lowerdeck/queue';
import { Prisma } from '../../../prisma/generated/client';
import { db } from '../../db';
import { env } from '../../env';
import { invocationsBucketRecord, storage } from '../../storage';

export let getTriggerRawEventPayloadStorageKey = (rawEventId: string) =>
  `trigger-raw-events/${rawEventId}/payload`;

export let getTriggerEventPayloadStorageKey = (triggerEventId: string) =>
  `trigger-events/${triggerEventId}/payload`;

export let triggerRawEventPayloadOffloadQueue = createQueue<{ rawEventId: string }>({
  name: 'shub/trg/evt/rawPayloadOffload',
  redisUrl: env.service.REDIS_URL
});

export let triggerRawEventPayloadOffloadQueueProcessor =
  triggerRawEventPayloadOffloadQueue.process(async data => {
    let rawEvent = await db.triggerRawEvent.findUnique({
      where: { id: data.rawEventId },
      select: { oid: true, processingStatus: true, payload: true, payloadStorageKey: true }
    });
    if (!rawEvent) return;
    if (rawEvent.processingStatus !== 'failed') return;
    if (rawEvent.payload === null || rawEvent.payloadStorageKey) return;

    let key = getTriggerRawEventPayloadStorageKey(data.rawEventId);
    await storage.putObject(
      invocationsBucketRecord.bucket,
      key,
      JSON.stringify(rawEvent.payload)
    );

    await db.triggerRawEvent.updateMany({
      where: { oid: rawEvent.oid, payloadStorageKey: null },
      data: { payload: Prisma.DbNull, payloadStorageKey: key }
    });
  });

export let triggerEventPayloadOffloadQueue = createQueue<{ triggerEventId: string }>({
  name: 'shub/trg/evt/payloadOffload',
  redisUrl: env.service.REDIS_URL
});

export let triggerEventPayloadOffloadQueueProcessor = triggerEventPayloadOffloadQueue.process(
  async data => {
    let event = await db.triggerEvent.findUnique({
      where: { id: data.triggerEventId },
      select: { oid: true, status: true, payload: true, payloadStorageKey: true }
    });
    if (!event) return;
    if (event.status !== 'mapped') return;
    if (event.payload === null || event.payloadStorageKey) return;

    let key = getTriggerEventPayloadStorageKey(data.triggerEventId);
    await storage.putObject(
      invocationsBucketRecord.bucket,
      key,
      JSON.stringify(event.payload)
    );

    await db.triggerEvent.updateMany({
      where: { oid: event.oid, payloadStorageKey: null },
      data: { payload: Prisma.DbNull, payloadStorageKey: key }
    });
  }
);

export let loadOffloadedTriggerEventPayload = async (
  storageKey: string
): Promise<PrismaJson.AnyRecord | null> => {
  try {
    let object = await storage.getObject(invocationsBucketRecord.bucket, storageKey);
    return JSON.parse(object.data.toString('utf-8'));
  } catch {
    return null;
  }
};
