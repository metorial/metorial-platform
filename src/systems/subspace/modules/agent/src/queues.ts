import { combineQueueProcessors } from '@mtsrc/queue';
import { lifecycleQueues } from './queues/lifecycle';
import { searchQueues } from './queues/search';

export let agentQueueProcessor = combineQueueProcessors([lifecycleQueues, searchQueues]);
