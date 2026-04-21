import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  syncAuthConfigEventQueueProcessor,
  syncAuthConfigEventsQueueProcessor
} from './authConfigEvents';
import { syncChangeNotificationsQueueProcessor } from './changeNotifications';
import {
  syncAuthConfigEventsCron,
  syncChangeNotificationsCron,
  syncOAuthSetupsCron,
  syncSlatesCron
} from './cron';
import { syncOAuthSetupQueueProcessor, syncOAuthSetupsQueueProcessor } from './oauthSetups';
import { syncSlateVersionQueueProcessor } from './syncSlateVersion';
import { syncSlatesQueueProcessor } from './syncSlates';

export let syncQueues = combineQueueProcessors([
  syncAuthConfigEventsQueueProcessor,
  syncAuthConfigEventQueueProcessor,
  syncAuthConfigEventsCron,
  syncChangeNotificationsQueueProcessor,
  syncChangeNotificationsCron,
  syncOAuthSetupsQueueProcessor,
  syncOAuthSetupQueueProcessor,
  syncOAuthSetupsCron,
  syncSlateVersionQueueProcessor,
  syncSlatesCron,
  syncSlatesQueueProcessor
]);
