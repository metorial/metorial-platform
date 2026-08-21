import { createCron } from '@lowerdeck/cron';
import { db } from '../../db';
import { env } from '../../env';
import {
  slateTriggerEventProcessQueue,
  slateTriggerWebhookDispatchOutboxQueue,
  slateTriggerWebhookReplayCleanupQueue
} from './eventQueues';

export let WEBHOOK_REPLAY_CLEANUP_BATCH_SIZE = 500;

export let cleanupExpiredWebhookReplayArtifacts = async (d: {
  store?: typeof db;
  before?: Date;
  batchSize?: number;
}) => {
  let store = d.store ?? db;
  let before = d.before ?? new Date();
  let batchSize = d.batchSize ?? WEBHOOK_REPLAY_CLEANUP_BATCH_SIZE;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
    throw new Error('Webhook replay cleanup batch size is invalid');
  }
  let outboxes = await store.slateTriggerWebhookDispatchOutbox.findMany({
    where: {
      retentionExpiresAt: { lte: before },
      status: { in: ['delivered', 'dead_letter'] },
      OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: before } }]
    },
    orderBy: { oid: 'asc' },
    take: batchSize,
    select: { oid: true }
  });
  let deletedOutboxes = outboxes.length
    ? await store.slateTriggerWebhookDispatchOutbox.deleteMany({
        where: {
          oid: { in: outboxes.map(item => item.oid) },
          retentionExpiresAt: { lte: before },
          status: { in: ['delivered', 'dead_letter'] },
          OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: before } }]
        }
      })
    : { count: 0 };
  let claims = await store.slateTriggerWebhookReplayClaim.findMany({
    where: {
      expiresAt: { lte: before },
      status: { in: ['responded', 'delivered', 'failed_terminal'] },
      OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: before } }],
      dispatchOutbox: { is: null }
    },
    orderBy: { oid: 'asc' },
    take: batchSize,
    select: { oid: true }
  });
  let deletedClaims = claims.length
    ? await store.slateTriggerWebhookReplayClaim.deleteMany({
        where: {
          oid: { in: claims.map(item => item.oid) },
          expiresAt: { lte: before },
          status: { in: ['responded', 'delivered', 'failed_terminal'] },
          OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: before } }],
          dispatchOutbox: { is: null }
        }
      })
    : { count: 0 };
  return {
    deletedOutboxes: deletedOutboxes.count,
    deletedClaims: deletedClaims.count,
    remaining: outboxes.length === batchSize || claims.length === batchSize
  };
};

export let repairWebhookReplayScheduling = async (d: {
  store?: typeof db;
  now?: Date;
  batchSize?: number;
  enqueueEventInputs?: typeof slateTriggerEventProcessQueue.addManyWithOps;
  enqueueOutboxes?: typeof slateTriggerWebhookDispatchOutboxQueue.addManyWithOps;
}) => {
  let store = d.store ?? db;
  let now = d.now ?? new Date();
  let batchSize = d.batchSize ?? WEBHOOK_REPLAY_CLEANUP_BATCH_SIZE;
  let unprocessed = await store.slateTriggerWebhookDispatchOutbox.findMany({
    where: {
      readyAt: null,
      status: { in: ['pending', 'retryable'] },
      eventInput: { status: { in: ['pending', 'retrying'] } }
    },
    take: batchSize,
    select: { eventInput: { select: { id: true } } }
  });
  await (d.enqueueEventInputs ?? slateTriggerEventProcessQueue.addManyWithOps)(
    unprocessed.map(item => ({
      data: { eventInputId: item.eventInput.id },
      opts: { id: item.eventInput.id }
    }))
  );
  let due = await store.slateTriggerWebhookDispatchOutbox.findMany({
    where: {
      readyAt: { not: null, lte: now },
      nextAttemptAt: { lte: now },
      OR: [
        { status: { in: ['pending', 'retryable'] } },
        { status: 'leased', leaseExpiresAt: { lte: now } }
      ]
    },
    take: batchSize,
    select: { id: true, attemptCount: true }
  });
  await (d.enqueueOutboxes ?? slateTriggerWebhookDispatchOutboxQueue.addManyWithOps)(
    due.map(item => ({
      data: { outboxId: item.id },
      opts: { id: `${item.id}:${item.attemptCount}` }
    }))
  );
  return { eventInputs: unprocessed.length, outboxes: due.length };
};

export let slateTriggerWebhookReplayCleanupQueueProcessor =
  slateTriggerWebhookReplayCleanupQueue.process(async data => {
    let before = data.before ? new Date(data.before) : new Date();
    if (Number.isNaN(before.getTime())) throw new Error('Invalid replay cleanup cutoff');
    await repairWebhookReplayScheduling({ now: before, batchSize: data.batchSize });
    let result = await cleanupExpiredWebhookReplayArtifacts({
      before,
      batchSize: data.batchSize
    });
    if (result.remaining) {
      await slateTriggerWebhookReplayCleanupQueue.add({
        before: before.toISOString(),
        batchSize: data.batchSize
      });
    }
  });

export let slateTriggerWebhookReplayCleanupCron = createCron(
  {
    name: 'shub/trg/webhook/replay-cleanup/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    await slateTriggerWebhookReplayCleanupQueue.add(
      { before: new Date().toISOString() },
      { id: 'periodic' }
    );
  }
);
