import { combineQueueProcessors } from '@lowerdeck/queue';
import { handleUpcomingCustomProviderQueueProcessor } from './handle';

export let upcomingQueues = combineQueueProcessors([
  handleUpcomingCustomProviderQueueProcessor
]);
