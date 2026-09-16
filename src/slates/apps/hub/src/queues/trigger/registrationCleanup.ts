import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { scheduleOrphanedTargetCleanup } from './_orphanedTargets';

export let triggerRegistrationCleanupQueue = createQueue<{ triggerRegistrationId: string }>({
  name: 'shub/trg/cleanup/1',
  redisUrl: env.service.REDIS_URL,
  jobOpts: { removeOnFail: true }
});

export let triggerRegistrationCleanupQueueProcessor = triggerRegistrationCleanupQueue.process(
  async data => {
    let registration = await db.triggerRegistration.findUnique({
      where: { id: data.triggerRegistrationId }
    });
    if (!registration || registration.status !== 'deleted') return;

    let instances = await db.triggerRegistrationInstance.findMany({
      where: { triggerRegistrationOid: registration.oid },
      select: { oid: true }
    });
    let instanceOids = instances.map(i => i.oid);

    let linkedTargetOids = [
      ...new Set(
        (
          await db.triggerRegistrationWebhook.findMany({
            where: { triggerRegistrationInstanceOid: { in: instanceOids } },
            select: { triggerWebhookTargetOid: true }
          })
        )
          .map(w => w.triggerWebhookTargetOid)
          .filter((oid): oid is bigint => oid !== null)
      )
    ];

    await db.triggerRegistrationSchedule.updateMany({
      where: { triggerRegistrationInstance: { triggerRegistrationOid: registration.oid } },
      data: { isDisabled: true }
    });

    await scheduleOrphanedTargetCleanup({
      targetOids: linkedTargetOids,
      triggerRegistrationId: registration.id
    });

    // Keep connection links until cleanup jobs are durable, so a retry can still find them.
    await db.triggerRegistrationWebhook.deleteMany({
      where: { triggerRegistrationInstanceOid: { in: instanceOids } }
    });
  }
);
