import { combineQueueProcessors } from '@mtsrc/queue';
import { deleteQueues } from './queues/delete';
import { lifecycleQueues } from './queues/lifecycle';

export let sessionQueueProcessor = combineQueueProcessors([lifecycleQueues, deleteQueues]);
