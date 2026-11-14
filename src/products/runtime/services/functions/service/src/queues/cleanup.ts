import { createCron } from '@lowerdeck/cron';
import { subHours } from 'date-fns';
import { db } from '../db';
import { env } from '../env';

export let cleanupProcessor = createCron(
  {
    name: 'fbay/cleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    let oneHourAgo = subHours(new Date(), 1);

    await db.functionBundle.deleteMany({
      where: {
        status: 'uploading',
        createdAt: { lt: oneHourAgo }
      }
    });
  }
);
