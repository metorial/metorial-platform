import { combineQueueProcessors } from '@metorial/queue';
import { reconcileAuthVersionProcessors } from './queues/reconcileAuthVersion';
import { syncProfileQueueProcessor } from './queues/syncProfile';

export * from './services';

export let organizationQueueProcessor = combineQueueProcessors([
  syncProfileQueueProcessor,
  reconcileAuthVersionProcessors
]);
