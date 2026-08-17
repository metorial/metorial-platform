import { combineQueueProcessors } from '@metorial/queue';

export * from './sendWithTemplate';
export * from './templates';

// No-op: relay handles queue processing now
export let emailQueueProcessor = combineQueueProcessors([]);
