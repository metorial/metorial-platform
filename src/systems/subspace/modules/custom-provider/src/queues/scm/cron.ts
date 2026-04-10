import { createCron } from '@lowerdeck/cron';
import { env } from '../../env';
import { scmSyncManyQueue } from './sync';

export let scmSyncManyCron = createCron(
  {
    name: 'sub/cpr/scm/sync/many/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    await scmSyncManyQueue.add({});
  }
);
