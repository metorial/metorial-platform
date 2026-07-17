import { createQueue } from '@lowerdeck/queue';
import { db, env } from '@metorial-cargo/db';
import { appendSkillDestinationSyncLog } from './_lib/logs';

export let syncFinishQueue = createQueue<{
  skillDestinationSyncId: string;
  status?: 'completed' | 'canceled';
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

  let status = data.status ?? 'completed';
  let updated = await db.skillDestinationSync.updateMany({
    where: { id: data.skillDestinationSyncId, status: 'processing' },
    data: { status, completedAt: new Date() }
  });
  if (updated.count === 0) return;

  await appendSkillDestinationSyncLog(
    data.skillDestinationSyncId,
    status === 'canceled' ? 'Sync canceled.' : 'Sync completed.'
  );
});
