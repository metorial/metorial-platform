import { combineQueueProcessors } from '@lowerdeck/queue';
import { registryQueues } from './queues/registry';
import { syncQueues } from './queues/sync';

export let slatesProviderQueues = combineQueueProcessors([syncQueues, registryQueues]);

export * from './impl';
