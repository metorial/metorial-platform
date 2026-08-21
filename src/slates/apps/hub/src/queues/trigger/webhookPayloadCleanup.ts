import { createCron } from '@lowerdeck/cron';
import { Prisma } from '../../../prisma/generated/client';
import { db } from '../../db';
import { env } from '../../env';
import { slateTriggerWebhookPayloadCleanupQueue } from './eventQueues';

export let WEBHOOK_PAYLOAD_CLEANUP_BATCH_SIZE = 500;

export let cleanupExpiredWebhookPayloads = async (d: {
  store?: typeof db;
  before?: Date;
  batchSize?: number;
}) => {
  let store = d.store ?? db;
  let before = d.before ?? new Date();
  let batchSize = d.batchSize ?? WEBHOOK_PAYLOAD_CLEANUP_BATCH_SIZE;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
    throw new Error('Webhook payload cleanup batch size is invalid');
  }
  let candidates = await store.slateTriggerWebhookRequest.findMany({
    where: {
      capturedRequestExpiresAt: { lte: before },
      capturedRequest: { not: Prisma.DbNull }
    },
    orderBy: { oid: 'asc' },
    take: batchSize,
    select: { oid: true }
  });
  if (candidates.length === 0) return { deleted: 0, remaining: false };
  let result = await store.slateTriggerWebhookRequest.updateMany({
    where: {
      oid: { in: candidates.map(candidate => candidate.oid) },
      capturedRequestExpiresAt: { lte: before },
      capturedRequest: { not: Prisma.DbNull }
    },
    data: {
      capturedRequest: Prisma.DbNull,
      capturedRequestExpiresAt: null
    }
  });
  return { deleted: result.count, remaining: candidates.length === batchSize };
};

export let slateTriggerWebhookPayloadCleanupQueueProcessor =
  slateTriggerWebhookPayloadCleanupQueue.process(async data => {
    let before = data.before ? new Date(data.before) : new Date();
    if (Number.isNaN(before.getTime())) {
      throw new Error('Webhook payload cleanup date is invalid');
    }
    let result = await cleanupExpiredWebhookPayloads({
      before,
      batchSize: data.batchSize
    });
    if (result.remaining) {
      await slateTriggerWebhookPayloadCleanupQueue.add({
        before: before.toISOString(),
        batchSize: data.batchSize
      });
    }
  });

export let slateTriggerWebhookPayloadCleanupCron = createCron(
  {
    name: 'shub/trg/webhook/payload-cleanup/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '17 * * * *'
  },
  async () => {
    await slateTriggerWebhookPayloadCleanupQueue.add(
      { before: new Date().toISOString() },
      { id: 'hourly' }
    );
  }
);
