import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { subDays } from 'date-fns';

export let cleanupCron = createCron(
  {
    name: 'community/cleanup',
    cron: '0 0 * * *'
  },
  async () => {
    let now = new Date();
    let oneMonthAgo = subDays(now, 30);

    await db.profileUpdate.deleteMany({
      where: {
        createdAt: {
          lt: oneMonthAgo
        }
      }
    });
  }
);
