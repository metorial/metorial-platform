import { createCron } from '@lowerdeck/cron';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { getCutoffDate } from './_config';

export let identityActorArchivedCleanupCron = createCron(
  {
    name: 'sub/idn/cron/identityActorArchivedCleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await db.identityActor.updateMany({
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
