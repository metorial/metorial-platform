import { createQueue } from '@lowerdeck/queue';
import { db, env } from '@metorial-cargo/db';

export let skillImportFinishQueue = createQueue<{ skillImportId: string }>({
  redisUrl: env.service.REDIS_URL,
  name: 'cargo/skill/import/finish',
  workerOpts: {
    concurrency: 5
  }
});

export let skillImportFinishQueueProcessor = skillImportFinishQueue.process(async data => {
  let skillImport = await db.skillImport.findUnique({
    where: { id: data.skillImportId },
    include: {
      items: {
        select: {
          status: true
        }
      }
    }
  });
  if (!skillImport || skillImport.status !== 'processing' || skillImport.items.length === 0)
    return;

  if (
    skillImport.items.some(item => item.status === 'pending' || item.status === 'processing')
  ) {
    return;
  }

  await db.skillImport.updateMany({
    where: { id: skillImport.id, status: 'processing' },
    data: {
      status: 'completed',
      completedAt: new Date()
    }
  });
});
