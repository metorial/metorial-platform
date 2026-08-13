import { combineQueueProcessors } from '@lowerdeck/queue';
import { metorialResourceQueues } from './queues/metorialResource';
import { resourceLinkQueues } from './queues/resourceLink';
import { retentionQueues } from './queues/retention';

export let tenantQueueProcessors = combineQueueProcessors([
  retentionQueues,
  resourceLinkQueues,
  metorialResourceQueues
]);
