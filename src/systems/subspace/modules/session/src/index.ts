import { combineQueueProcessors } from '@lowerdeck/queue';
import { deleteQueues } from './queues/delete';
import { lifecycleQueues } from './queues/lifecycle';

export * from './services';
export * from './lib/sessionProviderNameTemplate';

export let sessionQueueProcessor = combineQueueProcessors([lifecycleQueues, deleteQueues]);
