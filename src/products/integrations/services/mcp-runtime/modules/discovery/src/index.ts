import { combineQueueProcessors } from '@lowerdeck/queue';
import { discoverServerQueueProcessor } from './queues/discovery/server';

export * from './services';

export let discoveryQueueProcessor = combineQueueProcessors([discoverServerQueueProcessor]);
