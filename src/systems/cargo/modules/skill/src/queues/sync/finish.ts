import { createQueue } from '@mtsrc/queue';
import { db, env } from '@metorial-cargo/db';
import { appendSkillDestinationSyncLog } from './_lib/logs';

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
  let sync = await db.skillDestinationSync.findUnique({
    where: { id: data.skillDestinationSyncId }
  });
  if (!sync || sync.status !== 'processing') return;

  await db.skillDestinationSync.updateMany({
    where: { id: data.skillDestinationSyncId },
    data: { status: 'completed', completedAt: new Date() }
  });
  await appendSkillDestinationSyncLog(data.skillDestinationSyncId, 'Sync completed.');
});
