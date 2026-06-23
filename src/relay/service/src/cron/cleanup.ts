import { createCron } from '@lowerdeck/cron';
import { subDays } from 'date-fns';
import { db } from '../db';
import { env } from '../env';

export let cleanupCron = createCron(
  {
    name: 'fed/email/cleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    let now = new Date();
    let oneMonthAgo = subDays(now, 30);

    await db.outgoingEmail.deleteMany({
      where: {
        createdAt: {
          lt: oneMonthAgo
        }
      }
    });
  }
);
