import { combineQueueProcessors } from '@lowerdeck/queue';
import { retentionQueues } from './queues/retention';

export let tenantQueueProcessors = combineQueueProcessors([retentionQueues]);
