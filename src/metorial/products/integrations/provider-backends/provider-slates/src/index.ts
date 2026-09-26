import { combineQueueProcessors } from '@lowerdeck/queue';
import { slates } from './client';
import { syncQueues } from './queues/sync';

export let slatesProviderQueues = combineQueueProcessors([syncQueues]);

export * from './callbackReceiver';
export * from './impl';

export let slatesClient = slates;
