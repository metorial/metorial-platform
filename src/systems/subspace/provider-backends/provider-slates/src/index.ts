import { combineQueueProcessors } from '@mtsrc/queue';
import { slates } from './client';
import { registryQueues } from './queues/registry';
import { syncQueues } from './queues/sync';

export let slatesProviderQueues = combineQueueProcessors([syncQueues, registryQueues]);

export * from './impl';

export let slatesClient = slates;
