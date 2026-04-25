import { createCron } from '@lowerdeck/cron';
import { env } from '../../env';
import { syncAuthConfigEventsQueue } from './authConfigEvents';
import { syncChangeNotificationsQueue } from './changeNotifications';
import { syncOAuthSetupsQueue } from './oauthSetups';

export let syncChangeNotificationsCron = createCron(
  {
    name: 'sub/sht/cnhnotif/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    await syncChangeNotificationsQueue.add({}, { id: 'poll' });
  }
);

export let syncOAuthSetupsCron = createCron(
  {
    name: 'sub/shut/oauthSetup/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    await syncOAuthSetupsQueue.add({});
  }
);

export let syncAuthConfigEventsCron = createCron(
  {
    name: 'sub/shut/authEvt/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    await syncAuthConfigEventsQueue.add({});
  }
);
