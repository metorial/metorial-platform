import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { subDays } from 'date-fns';

export let cleanupCron = createCron(
  {
    name: 'scm/cleanup',
    cron: '0 0 * * *'
  },
  async () => {
    let now = new Date();
    let oneMonthAgo = subDays(now, 30);
    let oneWeekAgo = subDays(now, 7);

    await db.scmRepoWebhookReceivedEvent.deleteMany({
      where: {
        createdAt: {
          lt: oneWeekAgo
        }
      }
    });
  }
);
