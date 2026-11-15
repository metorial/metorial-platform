import type {
  SkillDestination,
  SkillDestinationSyncTrigger,
  SkillMarketplace
} from '@metorial/db';
import { addAfterTransactionHook, ID, withTransaction } from '@metorial/db';
import { syncStartQueue } from '../queues/sync/start';

export let forceSkillDestinationSync = async (d: {
  destination: Pick<SkillDestination, 'oid'>;
  incrementForceSyncCounterFor?: Pick<SkillMarketplace, 'oid'>;
  trigger?: SkillDestinationSyncTrigger;
  allowMassDelete?: boolean;
}) => {
  let sync = await withTransaction(async db => {
    if (d.incrementForceSyncCounterFor) {
      await db.skillMarketplace.update({
        where: { oid: d.incrementForceSyncCounterFor.oid },
        data: { forceSyncCounter: { increment: 1 } }
      });
    }

    await db.skillDestination.update({
      where: {
        oid: d.destination.oid
      },
      data: {
        syncRecoveryVersion: 1,
        isDirty: false,
        lastTransientChangeAt: null,
        firstTransientChangeAt: null,
        shouldFlushAt: null,
        mustFlushAt: null
      }
    });

    let sync = await db.skillDestinationSync.create({
      data: {
        id: await ID.generateId('skillDestinationSync'),
        destinationOid: d.destination.oid,
        status: 'pending',
        ...(d.trigger ? { trigger: d.trigger } : {}),
        ...(d.allowMassDelete ? { allowMassDelete: true } : {})
      }
    });

    await addAfterTransactionHook(async () => {
      await syncStartQueue.add({ skillDestinationSyncId: sync.id }, { id: sync.id });
    });

    return sync;
  });

  return sync;
};
