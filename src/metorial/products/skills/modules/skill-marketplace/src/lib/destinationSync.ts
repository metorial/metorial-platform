import type { SkillDestination, SkillRepository } from '@metorial/db';
import { db, ID, withTransaction } from '@metorial/db';
import { syncStartQueue } from '../queues/sync/start';

export let forceSkillDestinationSync = async (d: {
  destination: Pick<SkillDestination, 'oid'>;
  repository?: Pick<SkillRepository, 'id'>;
}) => {
  let sync = await withTransaction(async db => {
    await db.skillDestination.update({
      where: {
        oid: d.destination.oid
      },
      data: {
        isDirty: false,
        lastTransientChangeAt: null,
        firstTransientChangeAt: null,
        shouldFlushAt: null,
        mustFlushAt: null
      }
    });

    return await db.skillDestinationSync.create({
      data: {
        id: await ID.generateId('skillDestinationSync'),
        destinationOid: d.destination.oid,
        status: 'pending'
      }
    });
  });

  await syncStartQueue.add({
    skillDestinationSyncId: sync.id,
    skillRepositoryId: d.repository?.id
  });

  return sync;
};
