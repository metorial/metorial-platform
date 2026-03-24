import { combineQueueProcessors } from '@lowerdeck/queue';
import { lifecycleQueues } from './queues/lifecycle';
import { searchQueues } from './queues/search';

export * from './services';

export let deploymentQueueProcessor = combineQueueProcessors([lifecycleQueues, searchQueues]);
