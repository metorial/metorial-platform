import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { syncStartQueue } from './start';

let pageSize = 500;
let dispatchGraceMs = 60_000;
let stalledSyncMs = 30 * 60_000;

export let dispatchPendingSkillSyncsCron = createCron(
  { name: 'cargo/skill/sync/dispatch/cron', cron: '* * * * *' },
  async () => {
    await dispatchPendingSkillSyncsQueue.add({});
  }
);

let dispatchPendingSkillSyncsQueue = createQueue<{ cursor?: string }>({
  name: 'cargo/skill/sync/dispatch/many',
  workerOpts: { concurrency: 1 }
});

export let dispatchPendingSkillSyncsQueueProcessor = dispatchPendingSkillSyncsQueue.process(
  async data => {
    let syncs = await db.skillDestinationSync.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined,
        createdAt: { lte: new Date(Date.now() - dispatchGraceMs) },
        OR: [
          { status: 'pending' },
          {
            status: { in: ['processing', 'waiting_for_review'] },
            OR: [
              { updatedAt: { lte: new Date(Date.now() - stalledSyncMs) } },
              {
                repositoryPropagations: {
                  some: {
                    status: 'pending',
                    updatedAt: { lte: new Date(Date.now() - stalledSyncMs) }
                  }
                }
              }
            ]
          }
        ]
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: pageSize
    });

    if (!syncs.length) return;

    await syncStartQueue.addManyWithOps(
      syncs.map(sync => ({
        data: { skillDestinationSyncId: sync.id, recover: true },
        opts: { id: sync.id }
      }))
    );

    if (syncs.length === pageSize) {
      await dispatchPendingSkillSyncsQueue.add(
        { cursor: syncs[syncs.length - 1]!.id },
        { delay: 1000 }
      );
    }
  }
);
