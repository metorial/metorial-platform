import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { subDays } from 'date-fns';

export let customServerCleanupCron = createCron(
  {
    name: 'csrv/cleanup',
    cron: '0 * * * *'
  },
  async () => {
    let twoWeeksAgo = subDays(new Date(), 14);
    let oneMonthAgo = subDays(new Date(), 30);
    let oneHourAgo = subDays(new Date(), 1);

    await db.customServerDeployment.updateMany({
      where: {
        status: 'deploying',
        createdAt: { lt: oneHourAgo }
      },
      data: { status: 'failed' }
    });
  }
);
