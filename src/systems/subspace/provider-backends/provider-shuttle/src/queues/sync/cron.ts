import { createCron } from '@lowerdeck/cron';
import { env } from '../../env';
import { syncChangeNotificationsQueue } from './changeNotifications';

export let syncChangeNotificationsCron = createCron(
  {
    name: 'sub/sht/cnhnotif/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    await syncChangeNotificationsQueue.add({});
  }
);
