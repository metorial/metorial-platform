import { combineQueueProcessors } from '@lowerdeck/queue';
import { slates } from './client';
import { syncFederationQueues, syncQueues, syncSubspaceQueues } from './queues/sync';

export let slatesProviderSubspaceQueues = combineQueueProcessors([syncSubspaceQueues]);

export let slatesProviderFederationQueues = combineQueueProcessors([syncFederationQueues]);

export let slatesProviderQueues = combineQueueProcessors([syncQueues]);

export * from './callbackReceiver';
export * from './impl';

export let slatesClient = slates;
