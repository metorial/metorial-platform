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

    await db.providerOAuthConnectionAuthAttempt.deleteMany({
      where: {
        createdAt: {
          lte: twoWeeksAgo
        }
      }
    });

    await db.providerOAuthConnectionEvent.deleteMany({
      where: {
        createdAt: {
          lte: oneMonthAgo
        }
      }
    });

    // await db.providerOAuthConnectionAuthToken.deleteMany({
    //   where: {
    //     lastUsedAt: {
    //       lte: oneMonthAgo
    //     }
    //   }
    // });

    // await db.providerOAuthConnectionProfile.deleteMany({
    //   where: {
    //     lastUsedAt: {
    //       lte: oneMonthAgo
    //     }
    //   }
    // });
  }
);
