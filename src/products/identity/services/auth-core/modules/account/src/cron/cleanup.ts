import { createCron } from '@lowerdeck/cron';
import { env } from '../env';

export let accountCleanupCron = createCron(
  { name: 'auth-core/account/cleanup', cron: '0 0 * * *', redisUrl: env.service.REDIS_URL },
  async () => {}
);
