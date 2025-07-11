import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { syncEngineRun } from '../run/sync/run';

let runSyncCron = createCron(
  {
    name: 'eng/sync/run',
    cron: '* * * * *'
  },
  async () => {
    await syncRunsQueue.add({}, { id: 'sync-runs' });
  }
);

let syncRunsQueue = createQueue({
  name: 'eng/sync/runs',
  workerOpts: { concurrency: 1 }
});

let syncRunsQueueProcessor = syncRunsQueue.process(async () => {
  let cursor: string | undefined = undefined;

  while (true) {
    let runs: { id: string }[] = await db.engineRun.findMany({
      where: {
        id: cursor ? { gt: cursor } : undefined,
        isFinalized: false
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (runs.length === 0) break;

    await syncRunQueue.addMany(
      runs.map(run => ({
        runId: run.id
      }))
    );

    cursor = runs[runs.length - 1].id;
  }
});

let syncRunQueue = createQueue<{ runId: string }>({
  name: 'eng/sync/run'
});

let syncRunQueueProcessor = syncRunQueue.process(async data => {
  await syncEngineRun({ engineRunId: data.runId });
});

export let runSyncProcessors = combineQueueProcessors([
  syncRunsQueueProcessor,
  syncRunQueueProcessor,
  runSyncCron
]);
