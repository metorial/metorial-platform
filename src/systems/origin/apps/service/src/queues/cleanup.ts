import { createCron } from '@lowerdeck/cron';
import { subDays } from 'date-fns';
import { db } from '../db';
import { env } from '../env';

export let cleanupProcessor = createCron(
  {
    name: 'ori/cleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    let now = new Date();
    let oneWeekAgo = subDays(now, 7);

    await db.scmRepositoryWebhookReceivedEvent.deleteMany({
      where: {
        createdAt: {
          lt: oneWeekAgo
        }
      }
    });
  }
);
