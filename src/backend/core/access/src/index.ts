import { combineQueueProcessors } from '@metorial/queue';

export * from './services';

export let accessQueueProcessor = combineQueueProcessors([]);
