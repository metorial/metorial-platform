import { createQueue } from '@lowerdeck/queue';
import { db, env } from '@metorial-cargo/db';

export let syncFinishQueue = createQueue<{
  skillDestinationSyncId: string;
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'cargo/skill/sync/finish',
  workerOpts: {
    concurrency: 10
  }
});

export let syncFinishQueueProcessor = syncFinishQueue.process(async data => {
  let exp = await db.skillDestinationSync.findUnique({
    where: { id: data.skillDestinationSyncId }
  });
  if (!exp || exp.status !== 'processing') return;

  await db.skillDestinationSync.updateMany({
    where: { id: data.skillDestinationSyncId },
    data: { status: 'completed' }
  });
});
