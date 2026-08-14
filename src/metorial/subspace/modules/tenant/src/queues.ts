import { combineQueueProcessors } from '@lowerdeck/queue';
import { legacyScopeQueues } from './queues/legacyScope';
import { metorialResourceQueues } from './queues/metorialResource';
import { mirrorReferenceQueues } from './queues/mirrorReference';
import { resourceLinkQueues } from './queues/resourceLink';
import { retentionQueues } from './queues/retention';

export let tenantQueueProcessors = combineQueueProcessors([
  retentionQueues,
  resourceLinkQueues,
  mirrorReferenceQueues,
  metorialResourceQueues,
  legacyScopeQueues
]);
