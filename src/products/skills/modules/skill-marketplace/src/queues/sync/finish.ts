import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { withDestinationSyncLock } from './_lib/lock';
import { appendSkillDestinationSyncLog } from './_lib/logs';

export let syncFinishQueue = createQueue<{
  skillDestinationSyncId: string;
  status?: 'completed' | 'canceled';
}>({
  name: 'cargo/skill/sync/finish',
  workerOpts: {
    concurrency: 10
  }
});

export let syncFinishQueueProcessor = syncFinishQueue.process(
  withDestinationSyncLock(async data => {
    let sync = await db.skillDestinationSync.findUnique({
      where: { id: data.skillDestinationSyncId }
    });
    if (!sync || !['processing', 'waiting_for_review'].includes(sync.status)) return;

    if (!sync.isAtRepoSyncStage) return;

    let propagations = await db.skillDestinationSyncRepositoryPropagation.findMany({
      where: { skillDestinationSyncOid: sync.oid },
      select: { status: true }
    });
    if (
      propagations.some(propagation => !['completed', 'canceled'].includes(propagation.status))
    )
      return;

    let status: 'completed' | 'canceled' = propagations.some(
      propagation => propagation.status === 'canceled'
    )
      ? 'canceled'
      : 'completed';
    let updated = await db.skillDestinationSync.updateMany({
      where: {
        id: data.skillDestinationSyncId,
        status: { in: ['processing', 'waiting_for_review'] }
      },
      data: { status, completedAt: new Date() }
    });
    if (updated.count === 0) return;

    await appendSkillDestinationSyncLog(
      data.skillDestinationSyncId,
      status === 'canceled' ? 'Sync canceled.' : 'Sync completed.'
    );
  })
);
