import { createCron } from '@lowerdeck/cron';
import { subDays } from 'date-fns';
import { db } from '../../db';
import { env } from '../../env';

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
  }
);
