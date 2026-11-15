import { createCron } from '@lowerdeck/cron';
import { env } from '../env';

export let auditCleanupCron = createCron(
  { name: 'auth-core/audit/cleanup', cron: '0 0 * * *', redisUrl: env.service.REDIS_URL },
  async () => {}
);
