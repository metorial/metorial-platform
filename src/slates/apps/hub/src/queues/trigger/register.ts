import { createCron } from '@lowerdeck/cron';
import { QueueRetryError } from '@lowerdeck/queue';
import { getSentry } from '@lowerdeck/sentry';
import { db } from '../../db';
import { env } from '../../env';
import { slateTriggerReceiverService } from '../../services/slateTriggerReceiver';
import {
  beginRegistrationIntentInTransaction,
  registrationJobId,
  registrationQueueMetrics
} from '../../services/slateTriggerRegistrationLifecycle';
import { slateTriggerReceiverSecretService } from '../../services/slateTriggerReceiverSecret';
import { enqueuePendingRegistrationOutboxes } from '../../services/slateTriggerRegistrationOutbox';
import {
  slateTriggerReceiverFinalCleanupQueue,
  slateTriggerWebhookRegisterQueue,
  slateTriggerWebhookRegistrationRepairQueue,
  slateTriggerWebhookRetiringCleanupQueue,
  slateTriggerWebhookUnregisterQueue
} from './eventQueues';

let Sentry = getSentry();

let parsePayload = (data: unknown) => {
  if (
    typeof data !== 'object' ||
    data === null ||
    typeof (data as any).receiverTriggerId !== 'string' ||
    !Number.isInteger((data as any).registrationGeneration) ||
    (data as any).registrationGeneration <= 0
  ) {
    registrationQueueMetrics.invalidOrStaleJob('invalid_payload');
    return null;
  }
  return data as { receiverTriggerId: string; registrationGeneration: number };
};

export let slateTriggerWebhookRegisterQueueProcessor =
  slateTriggerWebhookRegisterQueue.process(async data => {
    let payload = parsePayload(data);
    if (!payload) return;

    try {
      await slateTriggerReceiverService.registerWebhookForReceiverTriggerId({
        receiverTriggerId: payload.receiverTriggerId,
        registrationGeneration: payload.registrationGeneration
      });
    } catch (error) {
      Sentry.captureException(error, {
        extra: { receiverTriggerId: payload.receiverTriggerId }
      });
      console.error('Failed to auto-register trigger webhook:', {
        receiverTriggerId: payload.receiverTriggerId,
        errorCode: 'webhook_registration_retry'
      });
      throw new QueueRetryError();
    }
  });

export let slateTriggerWebhookUnregisterQueueProcessor =
  slateTriggerWebhookUnregisterQueue.process(async data => {
    let payload = parsePayload(data);
    if (!payload) return;

    try {
      await slateTriggerReceiverService.unregisterWebhookForReceiverTriggerId({
        receiverTriggerId: payload.receiverTriggerId,
        registrationGeneration: payload.registrationGeneration
      });
    } catch (error) {
      Sentry.captureException(error, {
        extra: { receiverTriggerId: payload.receiverTriggerId }
      });
      console.error('Failed to auto-unregister trigger webhook:', {
        receiverTriggerId: payload.receiverTriggerId,
        errorCode: 'webhook_unregistration_retry'
      });
      throw new QueueRetryError();
    }
  });

export let slateTriggerWebhookRetiringCleanupQueueProcessor =
  slateTriggerWebhookRetiringCleanupQueue.process(async data => {
    if (
      !data ||
      typeof data.receiverTriggerId !== 'string' ||
      !Number.isInteger(data.registrationGeneration) ||
      data.registrationGeneration <= 0 ||
      !Number.isInteger(data.registrationVersion) ||
      data.registrationVersion <= 0
    ) {
      registrationQueueMetrics.invalidOrStaleJob('invalid_payload');
      return;
    }
    try {
      await slateTriggerReceiverService.cleanupRetiringWebhookRegistration(data);
    } catch (error) {
      Sentry.captureException(error, {
        extra: { receiverTriggerId: data.receiverTriggerId }
      });
      throw new QueueRetryError();
    }
  });

export let repairWebhookRegistrationScheduling = async (d: {
  now?: Date;
  batchSize?: number;
  store?: typeof db;
  enqueueRegister?: typeof slateTriggerWebhookRegisterQueue.addManyWithOps;
  enqueueUnregister?: typeof slateTriggerWebhookUnregisterQueue.addManyWithOps;
}) => {
  let now = d.now ?? new Date();
  let batchSize = Math.min(Math.max(d.batchSize ?? 250, 1), 1_000);
  let store = d.store ?? db;
  await enqueuePendingRegistrationOutboxes({ store, batchSize });
  let due = await store.slateTriggerReceiverTrigger.findMany({
    where: {
      OR: [
        { registrationStatus: 'pending', registrationEnqueueDeadlineAt: { lte: now } },
        { registrationStatus: 'failed', registrationEnqueueDeadlineAt: { lte: now } },
        {
          registrationStatus: { in: ['registering', 'renewing', 'unregistering'] },
          registrationLeaseExpiresAt: { lte: now }
        }
      ]
    },
    orderBy: { id: 'asc' },
    take: batchSize,
    select: {
      id: true,
      registrationGeneration: true,
      registrationTransitionVersion: true,
      registrationIntentKind: true
    }
  });
  let register = due.filter(
    item => !['unregister', 'delete'].includes(item.registrationIntentKind)
  );
  let unregister = due.filter(item =>
    ['unregister', 'delete'].includes(item.registrationIntentKind)
  );
  await (d.enqueueRegister ?? slateTriggerWebhookRegisterQueue.addManyWithOps)(
    register.map(item => ({
      data: {
        receiverTriggerId: item.id,
        registrationGeneration: item.registrationGeneration
      },
      opts: {
        id: `${registrationJobId({
          operation: item.registrationIntentKind,
          receiverTriggerId: item.id,
          registrationGeneration: item.registrationGeneration
        })}:repair:${item.registrationTransitionVersion}`
      }
    }))
  );
  await (d.enqueueUnregister ?? slateTriggerWebhookUnregisterQueue.addManyWithOps)(
    unregister.map(item => ({
      data: {
        receiverTriggerId: item.id,
        registrationGeneration: item.registrationGeneration
      },
      opts: {
        id: `${registrationJobId({
          operation: item.registrationIntentKind,
          receiverTriggerId: item.id,
          registrationGeneration: item.registrationGeneration
        })}:repair:${item.registrationTransitionVersion}`
      }
    }))
  );
  return { scanned: due.length, register: register.length, unregister: unregister.length };
};

export let slateTriggerWebhookRegistrationRepairQueueProcessor =
  slateTriggerWebhookRegistrationRepairQueue.process(async data => {
    await repairWebhookRegistrationScheduling({ batchSize: data.batchSize });
  });

export let slateTriggerWebhookRegistrationRepairCron = createCron(
  {
    name: 'shub/trg/registration-repair/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    await slateTriggerWebhookRegistrationRepairQueue.add({}, { id: 'periodic' });
  }
);

export let WEBHOOK_RENEWAL_LEAD_MS = 30 * 60 * 1000;

export let scheduleExpiringWebhookRenewals = async (d: {
  now?: Date;
  batchSize?: number;
  store?: typeof db;
  enqueueCleanup?: typeof slateTriggerWebhookRetiringCleanupQueue.addManyWithOps;
}) => {
  let now = d.now ?? new Date();
  let store = d.store ?? db;
  let batchSize = Math.min(Math.max(d.batchSize ?? 250, 1), 1_000);
  let scanned = 0;
  let scheduled = 0;
  let cleanupScheduled = 0;
  let failed = 0;
  let cursor: string | undefined;
  for (;;) {
    let candidates = await store.slateTriggerReceiverTrigger.findMany({
      where: {
        registrationStatus: 'registered',
        remoteRegistrationKnown: true,
        tombstonedAt: null,
        receiver: {
          slate: {
            OR: [
              {
                slateIdentifierOnRegistry: {
                  in: ['google-calendar', 'word-online']
                }
              },
              { slateIdOnRegistry: { in: ['google-calendar', 'word-online'] } }
            ]
          }
        }
      },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, registrationGeneration: true, registrationVersion: true }
    });
    if (candidates.length === 0) break;
    scanned += candidates.length;
    let outboxIds: string[] = [];
    let cleanupJobs: Array<{
      data: {
        receiverTriggerId: string;
        registrationGeneration: number;
        registrationVersion: number;
      };
      opts: { id: string };
    }> = [];
    for (let candidate of candidates) {
      let details: unknown;
      try {
        details = await slateTriggerReceiverSecretService.resolveRegistrationDetails({
          receiverTriggerId: candidate.id
        });
      } catch (error) {
        failed++;
        Sentry.captureException(error, {
          extra: {
            receiverTriggerId: candidate.id,
            operation: 'webhook_renewal_scan'
          }
        });
        continue;
      }
      if (!details || typeof details !== 'object' || Array.isArray(details)) continue;
      let retiringRaw = (details as Record<string, unknown>).retiringValidUntil;
      let retiringExpiration =
        typeof retiringRaw === 'string' && /^\d+$/.test(retiringRaw)
          ? Number(retiringRaw)
          : Date.parse(String(retiringRaw));
      if (Number.isFinite(retiringExpiration) && retiringExpiration <= now.getTime()) {
        cleanupJobs.push({
          data: {
            receiverTriggerId: candidate.id,
            registrationGeneration: candidate.registrationGeneration,
            registrationVersion: candidate.registrationVersion
          },
          opts: {
            id: `retiring-cleanup:${candidate.id}:${candidate.registrationGeneration}:${candidate.registrationVersion}`
          }
        });
      }
      let raw =
        (details as Record<string, unknown>).expiration ??
        (details as Record<string, unknown>).expirationDateTime;
      let expiration =
        typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : Date.parse(String(raw));
      if (
        !Number.isFinite(expiration) ||
        expiration > now.getTime() + WEBHOOK_RENEWAL_LEAD_MS
      ) {
        continue;
      }
      try {
        let intent = await store.$transaction(
          async tx =>
            await beginRegistrationIntentInTransaction({
              tx,
              receiverTriggerId: candidate.id,
              intent: 'renew',
              now
            })
        );
        outboxIds.push(intent.outboxId);
      } catch (error) {
        if (!(error instanceof Error && error.message.includes('CAS conflict'))) {
          failed++;
          Sentry.captureException(error, {
            extra: {
              receiverTriggerId: candidate.id,
              operation: 'webhook_renewal_schedule'
            }
          });
        }
      }
    }
    if (outboxIds.length) {
      await enqueuePendingRegistrationOutboxes({ store, outboxIds });
      scheduled += outboxIds.length;
    }
    if (cleanupJobs.length) {
      await (d.enqueueCleanup ?? slateTriggerWebhookRetiringCleanupQueue.addManyWithOps)(
        cleanupJobs
      );
      cleanupScheduled += cleanupJobs.length;
    }
    cursor = candidates[candidates.length - 1]!.id;
    if (candidates.length < batchSize) break;
  }
  await slateTriggerReceiverSecretService.cleanupExpiredRegistrationSecrets({ now });
  await slateTriggerReceiverSecretService.cleanupExpiredPathSecrets({ now });
  return { scanned, scheduled, cleanupScheduled, failed };
};

export let slateTriggerWebhookRenewalCron = createCron(
  {
    name: 'shub/trg/webhook-renewal/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    await scheduleExpiringWebhookRenewals({});
  }
);

export let TRIGGER_RECEIVER_FINAL_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export let finalizeTruthfulTriggerReceiverCleanup = async (d: {
  now?: Date;
  batchSize?: number;
  store?: typeof db;
}) => {
  let now = d.now ?? new Date();
  let store = d.store ?? db;
  let before = new Date(now.getTime() - TRIGGER_RECEIVER_FINAL_RETENTION_MS);
  let candidates = await store.slateTriggerReceiver.findMany({
    where: {
      tombstonedAt: { lte: before },
      triggers: {
        every: { registrationStatus: 'unregistered', remoteRegistrationKnown: false }
      }
    },
    orderBy: { id: 'asc' },
    take: Math.min(Math.max(d.batchSize ?? 250, 1), 1_000),
    select: { oid: true }
  });
  let deleted = 0;
  for (let candidate of candidates) {
    let result = await store.slateTriggerReceiver.deleteMany({
      where: {
        oid: candidate.oid,
        tombstonedAt: { lte: before },
        triggers: {
          every: { registrationStatus: 'unregistered', remoteRegistrationKnown: false }
        }
      }
    });
    deleted += result.count;
  }
  return { scanned: candidates.length, deleted };
};

export let slateTriggerReceiverFinalCleanupQueueProcessor =
  slateTriggerReceiverFinalCleanupQueue.process(async data => {
    await finalizeTruthfulTriggerReceiverCleanup({ batchSize: data.batchSize });
  });

export let slateTriggerReceiverFinalCleanupCron = createCron(
  {
    name: 'shub/trg/receiver-final-cleanup/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '17 * * * *'
  },
  async () => {
    await slateTriggerReceiverFinalCleanupQueue.add({}, { id: 'periodic' });
  }
);
