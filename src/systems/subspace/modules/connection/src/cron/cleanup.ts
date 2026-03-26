import { createCron } from '@lowerdeck/cron';
import { db } from '@metorial-subspace/db';
import { subHours } from 'date-fns';
import { env } from '../env';

export let connectionCleanupCron = createCron(
  {
    name: 'sub/con/cleanup',
    cron: '15 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    let twoHoursAgo = subHours(new Date(), 2);

    await db.sessionUsageRecord.deleteMany({
      where: {
        createdAt: { lt: twoHoursAgo }
      }
    });

    await db.providerRunUsageRecord.deleteMany({
      where: {
        createdAt: { lt: twoHoursAgo }
      }
    });
  }
);
