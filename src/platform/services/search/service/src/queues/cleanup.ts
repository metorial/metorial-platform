import { createCron } from '@lowerdeck/cron';
import { subDays } from 'date-fns';
import { env } from '../env';

export let cleanupProcessor = createCron(
  {
    name: 'voy/cleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    let twoWeeksAgo = subDays(new Date(), 14);
  }
);
