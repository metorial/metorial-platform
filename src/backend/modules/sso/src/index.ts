import { combineQueueProcessors } from '@metorial/queue';

export * from './services';

export let ssoQueueProcessor = combineQueueProcessors([]);
