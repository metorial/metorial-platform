import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { syncEngineRun } from '../run/sync/run';

let runSyncCron = createCron(
  {
    name: 'eng/sync/run/cron',
    cron: '* * * * *'
  },
  async () => {
    await syncRunsQueue.add({}, { id: 'sync-runs' });
  }
);

let syncRunsQueue = createQueue<{ engineSessionId?: string }>({
  name: 'eng/sync/runs',
  workerOpts: { concurrency: 1 }
});

let syncRunsQueueProcessor = syncRunsQueue.process(async data => {
  let cursor: string | undefined = undefined;

  while (true) {
    let runs: { id: string }[] = await db.engineRun.findMany({
      where: {
        id: cursor ? { gt: cursor } : undefined,
        isFinalized: false,
        engineSessionId: data.engineSessionId
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (runs.length === 0) break;

    await syncRunQueue.addManyWithOps(
      runs.map(run => ({
        data: { runId: run.id },
        opts: { id: run.id }
      }))
    );

    cursor = runs[runs.length - 1].id;
  }
});

let syncRunQueue = createQueue<{ runId: string }>({
  name: 'eng/sync/run',
  workerOpts: {
    concurrency: 20,
    limiter: { max: 50, duration: 1000 }
  }
});

let syncRunQueueProcessor = syncRunQueue.process(async data => {
  if (!data) return;
  await syncEngineRun({ engineRunId: data.runId });
});

export let addRunSync = async (data: { engineRunId: string }) => {
  await syncRunQueue.add({ runId: data.engineRunId }, { id: data.engineRunId });
};

export let addRunSyncsForSession = async (data: { engineSessionId: string }) => {
  await syncRunsQueue.add(
    { engineSessionId: data.engineSessionId },
    { id: data.engineSessionId }
  );
};

export let runSyncProcessors = combineQueueProcessors([
  syncRunsQueueProcessor,
  syncRunQueueProcessor,
  runSyncCron
]);
