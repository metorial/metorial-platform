import { combineQueueProcessors } from '@lowerdeck/queue';
import { resourceLinkQueues } from './queues/resourceLink';
import { retentionQueues } from './queues/retention';

export let tenantQueueProcessors = combineQueueProcessors([retentionQueues, resourceLinkQueues]);
