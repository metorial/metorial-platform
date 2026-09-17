import { db } from '../../db';
import { triggerWebhookUnregisterQueue } from './webhookUnregister';

// Callers must keep their own links until this succeeds so a retry still finds the targets.
export let scheduleOrphanedTargetCleanup = async (d: {
  targetOids: bigint[];
  triggerRegistrationId?: string;
}) => {
  if (d.targetOids.length === 0) return;

  let stillLinked = new Set(
    (
      await db.triggerRegistrationWebhook.findMany({
        where: {
          triggerWebhookTargetOid: { in: d.targetOids },
          triggerRegistrationInstance: { triggerRegistration: { status: 'active' } }
        },
        select: { triggerWebhookTargetOid: true }
      })
    ).map(w => w.triggerWebhookTargetOid)
  );

  let cleanableStatuses = ['creating', 'active', 'failed', 'deleting'] as const;
  let orphanedTargets = await db.triggerWebhookTarget.findMany({
    where: {
      oid: { in: d.targetOids.filter(oid => !stillLinked.has(oid)) },
      status: { in: [...cleanableStatuses] }
    },
    select: { oid: true, id: true }
  });
  if (orphanedTargets.length === 0) return;

  // Unlocked; the status filter guards against concurrent deletion.
  await db.triggerWebhookTarget.updateMany({
    where: {
      oid: { in: orphanedTargets.map(t => t.oid) },
      status: { in: [...cleanableStatuses] }
    },
    data: { status: 'deleting' }
  });

  await triggerWebhookUnregisterQueue.addManyWithOps(
    orphanedTargets.map(target => ({
      data: {
        triggerWebhookTargetId: target.id,
        triggerRegistrationId: d.triggerRegistrationId
      },
      opts: { id: target.id }
    }))
  );
};
