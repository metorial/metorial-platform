import { createCron } from '@lowerdeck/cron';
import { env } from '../env';

export let syncCleanupCron = createCron(
  { name: 'auth-core/sync/cleanup', cron: '0 0 * * *', redisUrl: env.service.REDIS_URL },
  async () => {}
);
