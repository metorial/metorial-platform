import { combineQueueProcessors } from '@metorial/queue';

export * from './services';

export let consumerQueueProcessor = combineQueueProcessors([]);
