import { combineQueueProcessors } from '@lowerdeck/queue';
import { deleteQueues } from './queues/delete';
import { lifecycleQueues } from './queues/lifecycle';

export let sessionQueueProcessor = combineQueueProcessors([lifecycleQueues, deleteQueues]);
