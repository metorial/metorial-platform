import { combineQueueProcessors } from '@lowerdeck/queue';
import { errorQueues } from './queues/error';

export let errorQueueProcessor = combineQueueProcessors([errorQueues]);
