import { createQueue } from '@lowerdeck/queue';
import { db, env } from '@metorial-cargo/db';
import { syncFinishQueue } from './finish';

export let syncPropagateQueue = createQueue<{
  skillDestinationSyncId: string;
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'cargo/skill/sync/propagate',
  workerOpts: {
    concurrency: 10
  }
});

export let syncPropagateQueueProcessor = syncPropagateQueue.process(async data => {
  let sync = await db.skillDestinationSync.findUnique({
    where: { id: data.skillDestinationSyncId },
    include: {
      destination: true
    }
  });
  if (!sync || sync.status !== 'processing') return;

  await syncFinishQueue.add({
    skillDestinationSyncId: data.skillDestinationSyncId
  });
});
