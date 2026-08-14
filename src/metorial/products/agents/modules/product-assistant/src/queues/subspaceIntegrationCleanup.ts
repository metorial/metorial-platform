import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';

export let subspaceIntegrationCleanupProcessor = createCron(
  {
    name: 'pa/sub/int/cleanup',
    cron: '0 0 * * *'
  },
  async () => {
    await db.productAssistantSubspaceMcpToolCache.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });
  }
);
