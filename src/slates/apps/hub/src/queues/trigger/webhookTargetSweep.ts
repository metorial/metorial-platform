import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import type { Prisma } from '../../../prisma/generated/client';
import { db } from '../../db';
import { env } from '../../env';
import {
  TRIGGER_WEBHOOK_TARGET_PRUNE_AFTER_MS,
  TRIGGER_WEBHOOK_TARGET_STALE_AFTER_MS
} from './_config';
import { scheduleOrphanedTargetCleanup } from './_orphanedTargets';
import { triggerWebhookUnregisterQueue } from './webhookUnregister';

let BATCH_SIZE = 500;

export let triggerWebhookTargetPruneQueue = createQueue<{
  triggerRegistrationInstanceId: string;
  discoveredBefore: Date;
  cursor?: bigint;
}>({
  name: 'shub/trg/whk/prune/1',
  redisUrl: env.service.REDIS_URL,
  jobOpts: { removeOnFail: true }
});

export let triggerWebhookTargetPruneQueueProcessor = triggerWebhookTargetPruneQueue.process(
  async data => {
    let instance = await db.triggerRegistrationInstance.findUnique({
      where: { id: data.triggerRegistrationInstanceId },
      include: { triggerRegistration: true }
    });
    if (!instance || instance.triggerRegistration.status !== 'active') return;

    let pruneCutoff = new Date(
      Math.min(
        data.discoveredBefore.getTime(),
        Date.now() - TRIGGER_WEBHOOK_TARGET_PRUNE_AFTER_MS
      )
    );
    let where: Prisma.TriggerRegistrationWebhookWhereInput = {
      triggerRegistrationInstanceOid: instance.oid,
      triggerWebhookTargetOid: { not: null },
      lastDiscoveredAt: { lt: pruneCutoff }
    };
    let staleLinks = await db.triggerRegistrationWebhook.findMany({
      where: { ...where, oid: data.cursor ? { gt: data.cursor } : undefined },
      orderBy: { oid: 'asc' },
      take: BATCH_SIZE
    });
    if (staleLinks.length > 0) {
      await db.triggerRegistrationWebhook.deleteMany({
        where: {
          ...where,
          oid: { in: staleLinks.map(link => link.oid) }
        }
      });
      await scheduleOrphanedTargetCleanup({
        targetOids: [...new Set(staleLinks.map(link => link.triggerWebhookTargetOid!))],
        triggerRegistrationId: instance.triggerRegistration.id
      });
    }

    if (staleLinks.length === BATCH_SIZE) {
      await triggerWebhookTargetPruneQueue.add({
        ...data,
        cursor: staleLinks[staleLinks.length - 1]!.oid
      });
    }
  }
);

export let triggerWebhookTargetSweepQueue = createQueue<{ cursor?: string }>({
  name: 'shub/trg/whk/sweep/1',
  redisUrl: env.service.REDIS_URL,
  jobOpts: { removeOnFail: true }
});

export let triggerWebhookTargetSweepQueueProcessor = triggerWebhookTargetSweepQueue.process(
  async data => {
    let staleCutoff = new Date(Date.now() - TRIGGER_WEBHOOK_TARGET_STALE_AFTER_MS);
    let stuckTargets = await db.triggerWebhookTarget.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined,
        updatedAt: { lt: staleCutoff },
        OR: [
          { status: { in: ['creating', 'deleting'] } },
          {
            status: { in: ['active', 'failed'] },
            webhooks: {
              none: {
                triggerRegistrationInstance: { triggerRegistration: { status: 'active' } }
              }
            }
          }
        ]
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE
    });
    if (stuckTargets.length > 0) {
      await triggerWebhookUnregisterQueue.addManyWithOps(
        stuckTargets.map(target => ({
          data: { triggerWebhookTargetId: target.id },
          opts: { id: target.id }
        }))
      );
    }
    if (stuckTargets.length === BATCH_SIZE) {
      await triggerWebhookTargetSweepQueue.add({
        cursor: stuckTargets[stuckTargets.length - 1]!.id
      });
    }
  }
);

export let triggerWebhookTargetSweepCron = createCron(
  {
    name: 'shub/trg/whk/sweep/cron/1',
    redisUrl: env.service.REDIS_URL,
    cron: '0 * * * *'
  },
  async () => {
    await triggerWebhookTargetSweepQueue.add({}, { id: 'sweep' });
  }
);
