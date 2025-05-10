import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { subDays } from 'date-fns';

export let secretCleanupCron = createCron(
  {
    name: 'sec/cleanup',
    cron: '0 0 * * *'
  },
  async () => {
    let twoWeeksAgo = subDays(new Date(), 14);

    await db.secretEvent.deleteMany({
      where: {
        createdAt: {
          lte: twoWeeksAgo
        }
      }
    });
  }
);
