import { combineQueueProcessors } from '@metorial/queue';

export * from './services';

export let eventQueueProcessor = combineQueueProcessors([]);
