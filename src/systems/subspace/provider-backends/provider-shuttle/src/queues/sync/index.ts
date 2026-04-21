import { combineQueueProcessors } from '@lowerdeck/queue';
import { syncChangeNotificationsQueueProcessor } from './changeNotifications';
import { syncChangeNotificationsCron, syncOAuthSetupsCron } from './cron';
import { syncOAuthSetupQueueProcessor, syncOAuthSetupsQueueProcessor } from './oauthSetups';
import { syncShuttleVersionQueueProcessor } from './syncShuttleVersion';

export let syncQueues = combineQueueProcessors([
  syncChangeNotificationsQueueProcessor,
  syncChangeNotificationsCron,
  syncOAuthSetupsQueueProcessor,
  syncOAuthSetupQueueProcessor,
  syncOAuthSetupsCron,
  syncShuttleVersionQueueProcessor
]);
