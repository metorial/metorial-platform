import { createCron } from '@lowerdeck/cron';
import { db } from '../db';
import { env } from '../env';

export let subspaceIntegrationCleanupProcessor = createCron(
  {
    name: 'syn/sub/int/cleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await db.subspaceMcpToolCache.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });
  }
);
