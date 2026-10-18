import { combineQueueProcessors } from '@lowerdeck/queue';
import { shuttle } from './client';
import { syncFederationQueues, syncQueues, syncSubspaceQueues } from './queues/sync';

export let shuttleProviderSubspaceQueues = combineQueueProcessors([syncSubspaceQueues]);

export let shuttleProviderFederationQueues = combineQueueProcessors([syncFederationQueues]);

export let shuttleProviderQueues = combineQueueProcessors([syncQueues]);

export * from './impl';
export * from './presenters';
export * from './services';

export let shuttleClient = shuttle;
