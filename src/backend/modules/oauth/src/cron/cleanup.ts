import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { subDays } from 'date-fns';

export let oauthCleanupCron = createCron(
  {
    name: 'oat/cleanup',
    cron: '0 0 * * *'
  },
  async () => {
    let twoWeeksAgo = subDays(new Date(), 14);
    let oneMonthAgo = subDays(new Date(), 30);

    await db.oAuthConnectionAuthAttempt.deleteMany({
      where: {
        createdAt: {
          lte: twoWeeksAgo
        }
      }
    });

    await db.oAuthConnectionEvent.deleteMany({
      where: {
        createdAt: {
          lte: oneMonthAgo
        }
      }
    });

    await db.oAuthConnectionAuthToken.deleteMany({
      where: {
        lastUsedAt: {
          lte: oneMonthAgo
        }
      }
    });

    await db.oAuthConnectionProfile.deleteMany({
      where: {
        lastUsedAt: {
          lte: oneMonthAgo
        }
      }
    });
  }
);
