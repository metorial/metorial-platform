import { combineQueueProcessors } from '@lowerdeck/queue';
import { retentionQueues } from './queues/retention';

export * from './lib/checkTenant';
export * from './services';

export let tenantQueueProcessors = combineQueueProcessors([retentionQueues]);
