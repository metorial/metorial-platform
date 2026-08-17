import { combineQueueProcessors } from '@metorial/queue';

export * from './services/portal';

export let portalQueueProcessor = combineQueueProcessors([]);
