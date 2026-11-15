import { createCron } from '@lowerdeck/cron';
import { db } from '@mtsrc/auth-core-db';
import { subDays } from 'date-fns';
import { env } from '../env';

export let ssoCleanupCron = createCron(
  { name: 'auth-core/sso/cleanup', cron: '0 0 * * *', redisUrl: env.service.REDIS_URL },
  async () => {
    let now = new Date();
    let oneWeekAgo = subDays(now, 7);
    let thirtyDaysAgo = subDays(now, 30);
    await db.ssoScimOperation.deleteMany({
      where: { createdAt: { lt: thirtyDaysAgo } }
    });

    await db.ssoDelegationAuthRequest.deleteMany({
      where: { expiresAt: { lt: now } }
    });

    await db.ssoDelegationAuthorizationCode.deleteMany({
      where: { expiresAt: { lt: now } }
    });

    await db.ssoDelegationToken.deleteMany({
      where: { expiresAt: { lt: now } }
    });

    await db.ssoTest.deleteMany({
      where: { createdAt: { lt: oneWeekAgo } }
    });

    await db.ssoAuth.deleteMany({
      where: { expiresAt: { lt: now } }
    });
  }
);
