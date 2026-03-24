import { combineQueueProcessors } from '@lowerdeck/queue';
import { syncChangeNotificationsQueueProcessor } from './changeNotifications';
import { syncChangeNotificationsCron } from './cron';
import { syncShuttleVersionQueueProcessor } from './syncShuttleVersion';

export let syncQueues = combineQueueProcessors([
  syncChangeNotificationsQueueProcessor,
  syncChangeNotificationsCron,
  syncShuttleVersionQueueProcessor
]);
