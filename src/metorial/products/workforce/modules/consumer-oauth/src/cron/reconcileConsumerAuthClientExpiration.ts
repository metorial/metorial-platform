import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { addMonths } from 'date-fns';

export let reconcileConsumerAuthClientExpirationCron = createCron(
  {
    name: 'coauth/client/expiration/reconcile',
    cron: '0 * * * *'
  },
  async () => {
    let now = new Date();
    await db.consumerAuthClient.updateMany({
      where: {
        expiresAt: { gt: now }
      },
      data: {
        expiresAt: addMonths(now, 3)
      }
    });
  }
);
