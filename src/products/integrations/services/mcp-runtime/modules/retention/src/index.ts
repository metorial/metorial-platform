import { combineQueueProcessors } from '@lowerdeck/queue';
import { retentionQueues } from './queues/retention';

export let retentionQueueProcessor = combineQueueProcessors([retentionQueues]);
