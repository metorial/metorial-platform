import { createCron } from '@lowerdeck/cron';
import { db } from '@metorial-subspace/db';
import { subDays } from 'date-fns';
import { env } from '../env';

export let cleanupCron = createCron(
  {
    name: 'sub/pint/cleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    let now = new Date();
    let oneMonthAgo = subDays(now, 30);

    await db.providerListingUpdate.deleteMany({
      where: {
        createdAt: {
          lt: oneMonthAgo
        }
      }
    });
  }
);
