import { createCron } from '@lowerdeck/cron';
import { subDays } from 'date-fns';
import { db } from '../../db';
import { env } from '../../env';

export let SLATE_DISCOVERY_RETENTION_DAYS = 5;

export let cleanupExpiredSlateVersionDiscoveries = async () => {
  let fiveDaysAgo = subDays(new Date(), SLATE_DISCOVERY_RETENTION_DAYS);

  await db.slateVersionDiscovery.deleteMany({
    where: {
      createdAt: { lt: fiveDaysAgo }
    }
  });
};

export let cleanupCron = createCron(
  {
    name: 'shub/cleanup/cron',
    cron: '0 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    let threeDaysAga = subDays(new Date(), 3);

    await db.slateAuthConfigManualDecrypt.deleteMany({
      where: {
        createdAt: { lt: threeDaysAga }
      }
    });

    await cleanupExpiredSlateVersionDiscoveries();
  }
);
