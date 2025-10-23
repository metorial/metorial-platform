import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { subDays } from 'date-fns';

export let cleanupCron = createCron(
  {
    name: 'clb/cleanup',
    cron: '0 0 * * *'
  },
  async () => {
    let now = new Date();
    let oneWeekAgo = subDays(now, 7);

    await db.callbackEvent.deleteMany({
      where: {
        createdAt: {
          lt: oneWeekAgo
        }
      }
    });

    await db.callbackPollingAttempt.deleteMany({
      where: {
        createdAt: {
          lt: oneWeekAgo
        }
      }
    });
  }
);
