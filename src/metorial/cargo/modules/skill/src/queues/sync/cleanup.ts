import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { subDays } from 'date-fns';

export let skillDestinationSyncCleanupCron = createCron(
  {
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
