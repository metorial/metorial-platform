import { createCron } from '@lowerdeck/cron';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { getSentry } from '@lowerdeck/sentry';
import { SlateTriggerEventInputStatus } from '../../../prisma/generated/client';
import { db } from '../../db';
import { env } from '../../env';
import { invocationsBucketRecord, storage } from '../../storage';
import { RETENTION_BATCH_SIZE, retentionStorageCleanupWorkerOpts } from '../retention/_config';

let Sentry = getSentry();

let terminalTriggerEventInputStatuses: SlateTriggerEventInputStatus[] = [
  SlateTriggerEventInputStatus.succeeded,
  SlateTriggerEventInputStatus.failed,
  SlateTriggerEventInputStatus.skipped
];

type TriggerCleanupRecordType = 'event_input' | 'webhook_request';

export let slateTriggerCleanupCron = createCron(
  {
    name: 'shub/trg/cleanup/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '0 1 * * *'
  },
  async () => {
    await slateTriggerCleanupManyQueue.add(
      { type: 'event_input' },
      { id: 'event_input_many' }
    );
    await slateTriggerCleanupManyQueue.add(
      { type: 'webhook_request' },
      { id: 'webhook_request_many' }
    );
  }
);

export let slateTriggerCleanupManyQueue = createQueue<{
  type: TriggerCleanupRecordType;
  cursor?: string;
}>({
  name: 'shub/trg/cleanup/many',
  redisUrl: env.service.REDIS_URL
});

export let slateTriggerCleanupManyQueueProcessor = slateTriggerCleanupManyQueue.process(
  async data => {
    if (data.type === 'event_input') {
      let eventInputs = await db.slateTriggerEventInput.findMany({
        where: {
          status: { in: terminalTriggerEventInputStatuses },
          id: data.cursor ? { gt: data.cursor } : undefined,
          payloadStoredAt: { not: null }
        },
        orderBy: { id: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { id: true }
      });
      if (eventInputs.length === 0) return;

      await slateTriggerCleanupSingleQueue.addMany(
        eventInputs.map(eventInput => ({
          type: 'event_input' as const,
          id: eventInput.id
        }))
      );

      await slateTriggerCleanupManyQueue.add({
        type: data.type,
        cursor: eventInputs[eventInputs.length - 1]!.id
      });
      return;
    }

    let webhookRequests = await db.slateTriggerWebhookRequest.findMany({
      where: {
        processedAt: { not: null },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: RETENTION_BATCH_SIZE,
      select: { id: true }
    });
    if (webhookRequests.length === 0) return;

    await slateTriggerCleanupSingleQueue.addMany(
      webhookRequests.map(webhookRequest => ({
        type: 'webhook_request' as const,
        id: webhookRequest.id
      }))
    );

    await slateTriggerCleanupManyQueue.add({
      type: data.type,
      cursor: webhookRequests[webhookRequests.length - 1]!.id
    });
  }
);

export let slateTriggerCleanupSingleQueue = createQueue<{
  type: TriggerCleanupRecordType;
  id: string;
}>({
  name: 'shub/trg/cleanup/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: retentionStorageCleanupWorkerOpts
});

let deleteTriggerEventInput = async (eventInputId: string) => {
  let eventInput = await db.slateTriggerEventInput.findUnique({
    where: { id: eventInputId }
  });
  if (!eventInput) return;
  if (!terminalTriggerEventInputStatuses.includes(eventInput.status)) return;
  if (!eventInput.payloadStoredAt) return;

  if (eventInput.payloadStorageKey) {
    await storage.deleteObject(invocationsBucketRecord.bucket, eventInput.payloadStorageKey);
  }

  await db.slateTriggerEventInput.delete({
    where: { oid: eventInput.oid }
  });
};

let deleteTriggerWebhookRequest = async (webhookRequestId: string) => {
  let webhookRequest = await db.slateTriggerWebhookRequest.findUnique({
    where: { id: webhookRequestId }
  });
  if (!webhookRequest || !webhookRequest.processedAt) return;

  await db.slateTriggerWebhookRequest.delete({
    where: { oid: webhookRequest.oid }
  });
};

export let slateTriggerCleanupSingleQueueProcessor = slateTriggerCleanupSingleQueue.process(
  async data => {
    try {
      if (data.type === 'event_input') {
        await deleteTriggerEventInput(data.id);
        return;
      }

      await deleteTriggerWebhookRequest(data.id);
    } catch (error) {
      Sentry.captureException(error, {
        extra: {
          cleanupType: data.type,
          cleanupRecordId: data.id
        }
      });
      console.error('Failed to cleanup trigger record:', {
        cleanupType: data.type,
        cleanupRecordId: data.id,
        error
      });
      throw new QueueRetryError();
    }
  }
);
