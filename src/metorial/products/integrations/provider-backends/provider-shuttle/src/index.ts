import { combineQueueProcessors } from '@lowerdeck/queue';
import { shuttle } from './client';
import { registryQueues } from './queues/registry';
import { syncQueues } from './queues/sync';

export let shuttleProviderQueues = combineQueueProcessors([syncQueues, registryQueues]);

export * from './impl';
export * from './presenters';
export * from './services';

export let shuttleClient = shuttle;
