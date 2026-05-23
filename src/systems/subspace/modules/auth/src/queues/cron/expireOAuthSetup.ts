import { createCron } from '@mtsrc/cron';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';

export let expireOAuthSetupCron = createCron(
  {
    name: 'sub/auth/cron/expireOAuthSetup',
    cron: '* * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await db.providerOAuthSetup.updateMany({
      where: { expiresAt: { lte: new Date() }, status: { in: ['unused', 'opened'] } },
      data: { status: 'expired' }
    });
  }
);
