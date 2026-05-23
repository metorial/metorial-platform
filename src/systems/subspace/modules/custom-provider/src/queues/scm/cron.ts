import { createCron } from '@mtsrc/cron';
import { env } from '../../env';
import { enqueueScmSyncMany } from './sync';

export let scmSyncManyCron = createCron(
  {
    name: 'sub/cpr/scm/sync/many/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    await enqueueScmSyncMany();
  }
);
