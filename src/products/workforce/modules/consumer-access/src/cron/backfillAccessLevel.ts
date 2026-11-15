import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';

export let backfillConsumerAccessLevelCron = createCron(
  {
    name: 'cons/accessLevel/backfill',
    cron: '* * * * *'
  },
  async () => {
    await db.consumerAccess.updateMany({
      where: {
        type: 'skill_marketplace',
        accessLevel: null
      },
      data: {
        accessLevel: 'read'
      }
    });

    await db.consumerAccess.updateMany({
      where: {
        type: { not: 'skill_marketplace' },
        accessLevel: { not: null }
      },
      data: {
        accessLevel: null
      }
    });
  }
);
