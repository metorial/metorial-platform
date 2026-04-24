import { combineQueueProcessors } from '@metorial/queue';
import { portalQueues } from './queues';

export * from './env';
export * from './lib/oauth';
export * from './portalUrlTemplate';
export * from './queues';
export * from './services';

export let portalQueueProcessor = combineQueueProcessors([portalQueues]);
