import { combineQueueProcessors } from '@lowerdeck/queue';
import { createChangeNotificationQueueProcessor } from './queues/changeNotification/create';

export * from './services';
export { createChangeNotificationQueue } from './queues/changeNotification/create';

export let changeNotificationsQueueProcessor = combineQueueProcessors([
  createChangeNotificationQueueProcessor
]);
