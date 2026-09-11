import { createCron } from '@lowerdeck/cron';
import { subDays } from 'date-fns';
import { env } from '../env';

export let cleanupCron = createCron(
  {
    name: 'sub/cat/cleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    let now = new Date();
    let oneMonthAgo = subDays(now, 30);
  }
);
