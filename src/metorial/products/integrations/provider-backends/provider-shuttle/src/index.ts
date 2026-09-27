import { combineQueueProcessors } from '@lowerdeck/queue';
import { shuttle } from './client';
import { syncQueues } from './queues/sync';

export let shuttleProviderQueues = combineQueueProcessors([syncQueues]);

export * from './impl';
export * from './presenters';
export * from './services';

export let shuttleClient = shuttle;
