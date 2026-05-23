import { combineQueueProcessors } from '@mtsrc/queue';
import { handleUpcomingCustomProviderQueueProcessor } from './handle';

export let upcomingQueues = combineQueueProcessors([
  handleUpcomingCustomProviderQueueProcessor
]);
