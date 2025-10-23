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
    let twoWeeksAgo = subDays(now, 14);

    await db.callbackEvent.deleteMany({
      where: {
        createdAt: {
          lt: twoWeeksAgo
        }
      }
    });

    await db.callbackPollingAttempt.deleteMany({
      where: {
        createdAt: {
          lt: twoWeeksAgo
        }
      }
    });

    await db.callbackNotification.deleteMany({
      where: {
        createdAt: {
          lt: twoWeeksAgo
        }
      }
    });
  }
);
