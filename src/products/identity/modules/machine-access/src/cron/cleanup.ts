import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { subDays } from 'date-fns';

export let cleanupCron = createCron(
  {
    name: 'macc/cleanup',
    cron: '0 0 * * *'
  },
  async () => {
    let twoDaysAgo = subDays(new Date(), 2);

    await db.oAuthAuthorizationFlow.deleteMany({
      where: {
        OR: [
          {
            createdAt: {
              lte: twoDaysAgo
            },
            status: 'consumed'
          },
          {
            expiresAt: {
              lte: twoDaysAgo
            }
          }
        ]
      }
    });
  }
);
