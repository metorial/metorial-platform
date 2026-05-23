import { createCron } from '@mtsrc/cron';
import { db, env } from '@metorial-cargo/db';
import { subDays } from 'date-fns';

export let skillDestinationSyncCleanupCron = createCron(
  {
    redisUrl: env.service.REDIS_URL,
    name: 'cargo/skill/sync/cleanup/cron',
    cron: '0 0 * * *'
  },
  async () => {
    let twoWeeksAgo = subDays(new Date(), 14);

    await db.skillDestinationSync.deleteMany({
      where: {
        createdAt: {
          lt: twoWeeksAgo
        }
      }
    });
  }
);
