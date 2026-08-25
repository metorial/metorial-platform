import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { triggerWebhookUnregisterQueue } from './webhookUnregister';

export let triggerRegistrationCleanupQueue = createQueue<{ triggerRegistrationId: string }>({
  name: 'shub/trg/cleanup',
  redisUrl: env.service.REDIS_URL
});

export let triggerRegistrationCleanupQueueProcessor = triggerRegistrationCleanupQueue.process(
  async data => {
    let registration = await db.triggerRegistration.findUnique({
      where: { id: data.triggerRegistrationId }
    });
    if (!registration) return;

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

    await db.$transaction(async db => {
      await db.triggerRegistrationSchedule.updateMany({
        where: { triggerRegistrationInstance: { triggerRegistrationOid: registration.oid } },
        data: { isDisabled: true }
      });

      if (instanceOids.length > 0) {
        await db.triggerRegistrationWebhook.deleteMany({
          where: { triggerRegistrationInstanceOid: { in: instanceOids } }
        });
      }
    });

    if (linkedTargetOids.length === 0) return;

    let stillLinked = new Set(
      (
        await db.triggerRegistrationWebhook.findMany({
          where: { triggerWebhookTargetOid: { in: linkedTargetOids } },
          select: { triggerWebhookTargetOid: true }
        })
      ).map(w => w.triggerWebhookTargetOid)
    );
    let orphanedTargets = await db.triggerWebhookTarget.findMany({
      where: {
        oid: { in: linkedTargetOids.filter(oid => !stillLinked.has(oid)) },
        status: { in: ['creating', 'active'] }
      },
      select: { oid: true, id: true }
    });
    if (orphanedTargets.length === 0) return;

    await db.triggerWebhookTarget.updateMany({
      where: { oid: { in: orphanedTargets.map(t => t.oid) } },
      data: { status: 'deleting' }
    });

    await triggerWebhookUnregisterQueue.addManyWithOps(
      orphanedTargets.map(target => ({
        data: { triggerWebhookTargetId: target.id },
        opts: { id: target.id }
      }))
    );
  }
);
