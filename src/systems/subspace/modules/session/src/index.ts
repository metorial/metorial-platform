import { combineQueueProcessors } from '@lowerdeck/queue';
import { lifecycleQueues } from './queues/lifecycle';

export * from './services';

export let sessionQueueProcessor = combineQueueProcessors([lifecycleQueues]);
