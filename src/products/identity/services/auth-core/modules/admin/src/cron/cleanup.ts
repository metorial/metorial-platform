import { createCron } from '@lowerdeck/cron';
import { env } from '../env';

export let adminCleanupCron = createCron(
  { name: 'auth-core/admin/cleanup', cron: '0 0 * * *', redisUrl: env.service.REDIS_URL },
  async () => {}
);
