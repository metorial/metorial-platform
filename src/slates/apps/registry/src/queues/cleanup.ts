import { createCron } from '@lowerdeck/cron';
import { subDays, subHours } from 'date-fns';
import { env } from '../env';

export let cleanupProcessor = createCron(
  {
    name: 'sreg/cleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    let _threeDaysAgo = subDays(new Date(), 3);
    let _oneHourAgo = subHours(new Date(), 1);
  }
);
