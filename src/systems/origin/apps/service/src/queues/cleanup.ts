import { createCron } from '@mtsrc/cron';
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
    let twoWeeksAgo = subDays(now, 14);

    await db.scmRepositoryWebhookReceivedEvent.deleteMany({
      where: {
        createdAt: {
          lt: oneWeekAgo
        }
      }
    });

    await db.scmRepositorySync.deleteMany({
      where: {
        createdAt: {
          lt: twoWeeksAgo
        }
      }
    });
  }
);
