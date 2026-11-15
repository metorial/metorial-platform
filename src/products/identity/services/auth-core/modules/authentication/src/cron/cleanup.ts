import { createCron } from '@lowerdeck/cron';
import { db } from '@mtsrc/auth-core-db';
import { subDays } from 'date-fns';
import { env } from '../env';

export let authenticationCleanupCron = createCron(
  { name: 'fed/id/cleanup', cron: '0 0 * * *', redisUrl: env.service.REDIS_URL },
  async () => {
    let now = new Date();
    let oneWeekAgo = subDays(now, 7);
    await db.authAttempt.deleteMany({
      where: { createdAt: { lt: oneWeekAgo } }
    });

    await db.authIntent.deleteMany({
      where: { createdAt: { lt: oneWeekAgo } }
    });

    await db.authBlock.deleteMany({
      where: { blockedAt: { lt: oneWeekAgo } }
    });
  }
);
