import { createQueue } from '@lowerdeck/queue';
import { Prisma } from '../../../prisma/generated/client';
import { db } from '../../db';
import { env } from '../../env';
import { invocationsBucketRecord, storage } from '../../storage';

export let getWebhookEventRequestStorageKey = (webhookEventId: string) =>
  `webhook-events/${webhookEventId}/request`;

export let webhookEventPayloadOffloadQueue = createQueue<{ webhookEventId: string }>({
  name: 'shub/whk/payloadOffload',
  redisUrl: env.service.REDIS_URL
});

export let webhookEventPayloadOffloadQueueProcessor = webhookEventPayloadOffloadQueue.process(
  async data => {
    let event = await db.slateWebhookEvent.findUnique({
      where: { id: data.webhookEventId },
      select: { oid: true, status: true, request: true, requestStorageKey: true }
    });
    if (!event) return;
    if (event.status !== 'succeeded' && event.status !== 'failed_final') return;
    if (event.request === null || event.requestStorageKey) return;

    let key = getWebhookEventRequestStorageKey(data.webhookEventId);
    await storage.putObject(
      invocationsBucketRecord.bucket,
      key,
      JSON.stringify(event.request)
    );

    await db.slateWebhookEvent.updateMany({
      where: { oid: event.oid, requestStorageKey: null },
      data: { request: Prisma.DbNull, requestStorageKey: key }
    });
  }
);

export let loadOffloadedWebhookEventRequest = async (
  storageKey: string
): Promise<PrismaJson.SlateWebhookEventRequest | null> => {
  try {
    let object = await storage.getObject(invocationsBucketRecord.bucket, storageKey);
    return JSON.parse(object.data.toString('utf-8'));
  } catch {
    return null;
  }
};
