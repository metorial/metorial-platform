import { combineQueueProcessors } from '@lowerdeck/queue';
import { triggerRoutingMatcherResyncQueueProcessor } from './queues/routingMatcherResync';

export let triggerRoutingQueueProcessor = combineQueueProcessors([
  triggerRoutingMatcherResyncQueueProcessor
]);
