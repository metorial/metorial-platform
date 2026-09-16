import { db } from '../../db';
import { triggerWebhookUnregisterQueue } from './webhookUnregister';

// Marks every given target that no active connection links to anymore as `deleting` and
// schedules provider cleanup for it. Callers keep their own links intact until this has
// succeeded, so a retried caller can still find the same targets.
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

  // No lock is held here; the status guard keeps a target that was deleted meanwhile deleted.
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
