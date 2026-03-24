import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { syncRegistryQueue } from './syncRegistry';

export let registrySyncCron = createCron(
  {
    name: 'shub/reg/sync/cron',
    cron: '* * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await syncRegistryAllQueue.add({});
  }
);

let syncRegistryAllQueue = createQueue({
  name: 'shub/reg/sync/all',
  redisUrl: env.service.REDIS_URL
});

await syncRegistryAllQueue.add({});

export let syncRegistryAllQueueProcessor = syncRegistryAllQueue.process(async _data => {
  let cursor: string | undefined;

  while (true) {
    let regs = await db.registry.findMany({
      where: {
        status: 'active',
        id: cursor ? { gt: cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100
    });
    if (regs.length === 0) break;

    await syncRegistryQueue.addManyWithOps(
      regs.map(r => ({
        data: { registryId: r.id },
        opts: { id: r.id }
      }))
    );

    cursor = regs[regs.length - 1]?.id as string;
  }
});
