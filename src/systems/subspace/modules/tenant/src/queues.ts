import { combineQueueProcessors } from '@mtsrc/queue';
import { retentionQueues } from './queues/retention';

export let tenantQueueProcessors = combineQueueProcessors([retentionQueues]);
