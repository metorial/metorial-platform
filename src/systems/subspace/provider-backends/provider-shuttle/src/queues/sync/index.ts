import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  syncAuthConfigEventQueueProcessor,
  syncAuthConfigEventsQueueProcessor
} from './authConfigEvents';
import { syncChangeNotificationsQueueProcessor } from './changeNotifications';
import {
  syncAuthConfigEventsCron,
  syncChangeNotificationsCron,
  syncOAuthSetupsCron
} from './cron';
import { syncOAuthSetupQueueProcessor, syncOAuthSetupsQueueProcessor } from './oauthSetups';
import { syncShuttleVersionQueueProcessor } from './syncShuttleVersion';

export let syncQueues = combineQueueProcessors([
  syncAuthConfigEventsQueueProcessor,
  syncAuthConfigEventQueueProcessor,
  syncAuthConfigEventsCron,
  syncChangeNotificationsQueueProcessor,
  syncChangeNotificationsCron,
  syncOAuthSetupsQueueProcessor,
  syncOAuthSetupQueueProcessor,
  syncOAuthSetupsCron,
  syncShuttleVersionQueueProcessor
]);
