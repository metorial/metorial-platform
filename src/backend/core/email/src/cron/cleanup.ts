import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { subDays } from 'date-fns';

export let cleanupCron = createCron(
  {
    name: 'email/cleanup',
    cron: '0 0 * * *'
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
