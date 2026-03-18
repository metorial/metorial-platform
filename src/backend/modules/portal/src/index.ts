import { combineQueueProcessors } from '@metorial/queue';

export * from './env';
export * from './portalUrlTemplate';
export * from './services';

export let portalQueueProcessor = combineQueueProcessors([]);
