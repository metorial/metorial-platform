import { createQueue } from '@lowerdeck/queue';
import { Prisma } from '@mtsrc/slates-hub-db/client';
import { db } from '@mtsrc/slates-hub-db/db';
import { env } from '@mtsrc/slates-hub-env/env';
import { invocationsBucketRecord, storage } from '@mtsrc/slates-hub-storage/storage';
import { getWebhookEventRequestStorageKey } from '@mtsrc/slates-hub-storage/payloads';

export let webhookEventPayloadOffloadQueue = createQueue<{ webhookEventId: string }>({
  name: 'shub/whk/payloadOffload',
  workerOpts: { concurrency: 50 },
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
