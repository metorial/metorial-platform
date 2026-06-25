import { createCron } from '@lowerdeck/cron';
import { subDays } from 'date-fns';
import { db } from '../../db';
import { env } from '../../env';

export let discoveryCleanupCron = createCron(
  {
    name: 'shut/cron/discovery-cleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    let twoDaysAgo = subDays(new Date(), 2);

    await db.serverDiscovery.deleteMany({
      where: {
        createdAt: { lt: twoDaysAgo }
      }
    });
  }
);
