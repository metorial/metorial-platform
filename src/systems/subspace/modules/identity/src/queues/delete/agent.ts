import { createCron } from '@lowerdeck/cron';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { getCutoffDate } from './_config';

export let agentArchivedCleanupCron = createCron(
  {
    name: 'sub/idn/cron/agentArchivedCleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await db.agent.updateMany({
      where: {
        status: 'archived',
        archivedAt: { lt: getCutoffDate() }
      },
      data: {
        status: 'deleted',

        name: '[deleted]',
        description: null,
        metadata: {}
      }
    });
  }
);
