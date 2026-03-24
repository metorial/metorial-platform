import { createCron } from '@lowerdeck/cron';
import { env } from '../../env';
import { syncChangeNotificationsQueue } from './changeNotifications';
import { syncSlatesQueue } from './syncSlates';

export let syncChangeNotificationsCron = createCron(
  {
    name: 'sub/slt/cnhnotif/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    await syncChangeNotificationsQueue.add({});
  }
);

export let syncSlatesCron = createCron(
  {
    name: 'sub/slt/slate/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '0 * * * *'
  },
  async () => {
    await syncSlatesQueue.add({});
  }
);
