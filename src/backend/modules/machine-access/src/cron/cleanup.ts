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

    await db.oAuthAuthorizationRequest.deleteMany({
      where: {
        createdAt: {
          lte: twoDaysAgo
        },
        status: 'pending'
      }
    });

    await db.oAuthAuthorizationRequest.updateMany({
      where: {
        expiresAt: {
          lte: twoDaysAgo
        },
        OR: [
          { userCode: { not: null } },
          { deviceCode: { not: null } },
          { lastPollAt: { not: null } },
          { codeChallenge: { not: null } }
        ]
      },
      data: {
        userCode: null,
        deviceCode: null,
        lastPollAt: null,
        codeChallenge: null
      }
    });
  }
);
