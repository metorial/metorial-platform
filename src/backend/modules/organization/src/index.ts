import { combineQueueProcessors } from '@metorial/queue';
import { syncProfileQueueProcessor } from './queues/syncProfile';

export * from './services';

export let organizationQueueProcessor = combineQueueProcessors([syncProfileQueueProcessor]);
