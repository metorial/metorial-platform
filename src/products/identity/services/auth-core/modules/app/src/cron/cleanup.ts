import { createCron } from '@lowerdeck/cron';
import { env } from '../env';

export let appCleanupCron = createCron(
  { name: 'auth-core/app/cleanup', cron: '0 0 * * *', redisUrl: env.service.REDIS_URL },
  async () => {}
);
