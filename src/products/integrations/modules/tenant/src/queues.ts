import { combineQueueProcessors } from '@lowerdeck/queue';
import { retentionQueues } from './queues/retention';

export let tenantSubspaceQueueProcessors = combineQueueProcessors([]);

export let tenantFederationQueueProcessors = combineQueueProcessors([retentionQueues]);

export let tenantQueueProcessors = combineQueueProcessors([
  tenantSubspaceQueueProcessors,
  tenantFederationQueueProcessors
]);
