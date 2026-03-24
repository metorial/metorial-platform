import { combineQueueProcessors } from '@lowerdeck/queue';
import { syncChangeNotificationsQueueProcessor } from './changeNotifications';
import { syncChangeNotificationsCron, syncSlatesCron } from './cron';
import { syncSlateVersionQueueProcessor } from './syncSlateVersion';
import { syncSlatesQueueProcessor } from './syncSlates';

export let syncQueues = combineQueueProcessors([
  syncChangeNotificationsQueueProcessor,
  syncChangeNotificationsCron,
  syncSlateVersionQueueProcessor,
  syncSlatesCron,
  syncSlatesQueueProcessor
]);
