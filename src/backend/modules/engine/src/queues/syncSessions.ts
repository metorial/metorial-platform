import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { syncEngineSession } from '../run/sync/session';

let sessionSyncCron = createCron(
  {
    name: 'eng/sync/ses/cron',
    cron: '* * * * *'
  },
  async () => {
    await syncSessionsQueue.add({}, { id: 'sync-sessions' });
  }
);

let syncSessionsQueue = createQueue({
  name: 'eng/sync/sess',
  workerOpts: { concurrency: 1 }
});

let syncSessionsQueueProcessor = syncSessionsQueue.process(async () => {
  let cursor: string | undefined = undefined;

  while (true) {
    let sessions: { id: string }[] = await db.engineSession.findMany({
      where: {
        id: cursor ? { gt: cursor } : undefined,
        isFinalized: false
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (sessions.length === 0) break;

    await syncSessionQueue.addManyWithOps(
      sessions.map(session => ({
        data: { sessionId: session.id },
        opts: { id: session.id }
      }))
    );

    cursor = sessions[sessions.length - 1].id;
  }
});

let syncSessionQueue = createQueue<{ sessionId: string }>({
  name: 'eng/sync/ses'
});

let syncSessionQueueProcessor = syncSessionQueue.process(async data => {
  if (!data) return;
  await syncEngineSession({ engineSessionId: data.sessionId });
});

export let addSessionSync = async (data: { engineSessionId: string }) => {
  await syncSessionQueue.add(
    { sessionId: data.engineSessionId },
    { id: data.engineSessionId }
  );
};

export let sessionSyncProcessors = combineQueueProcessors([
  syncSessionsQueueProcessor,
  syncSessionQueueProcessor,
  sessionSyncCron
]);
