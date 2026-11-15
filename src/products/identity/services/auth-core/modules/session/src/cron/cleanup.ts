import { createCron } from '@lowerdeck/cron';
import { env } from '../env';

export let sessionCleanupCron = createCron(
  { name: 'auth-core/session/cleanup', cron: '0 0 * * *', redisUrl: env.service.REDIS_URL },
  async () => {}
);
