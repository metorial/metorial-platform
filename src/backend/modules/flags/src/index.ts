import { combineQueueProcessors } from '@metorial/queue';

export * from './definitions';
export * from './services';

export let eventQueueProcessor = combineQueueProcessors([]);
