import { combineQueueProcessors } from '@lowerdeck/queue';
import { tenantsQueues } from './queues';

export * from './services';

export let tenantsQueueProcessor = combineQueueProcessors([tenantsQueues]);
