import { createCron } from '@mtsrc/cron';
import { backend } from '../../backend';
import { env } from '../../env';
import { syncAuthConfigEventsQueue } from './authConfigEvents';
import { syncChangeNotificationsQueue } from './changeNotifications';
import { syncOAuthSetupsQueue } from './oauthSetups';
import { syncSlatesQueue } from './syncSlates';

export let syncChangeNotificationsCron = createCron(
  {
    name: 'sub/slt/cnhnotif/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    await syncChangeNotificationsQueue.add({}, { id: backend.id });
  }
);

export let syncAuthConfigEventsCron = createCron(
  {
    name: 'sub/slt/authEvt/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    await syncAuthConfigEventsQueue.add({});
  }
);

export let syncOAuthSetupsCron = createCron(
  {
    name: 'sub/slt/oauthSetup/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    await syncOAuthSetupsQueue.add({});
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
