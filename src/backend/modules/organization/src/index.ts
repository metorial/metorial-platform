import { combineQueueProcessors } from '@metorial/queue';
import { reconcileAuthVersionProcessors } from './queues/reconcileAuthVersion';
import { reconcileDefaultPoliciesProcessors } from './queues/reconcileDefaultPolicies';
import { syncBrandQueueProcessor } from './queues/syncBrand';
import { syncProfileQueueProcessor } from './queues/syncProfile';

export * from './services';

export let organizationQueueProcessor = combineQueueProcessors([
  syncBrandQueueProcessor,
  syncProfileQueueProcessor,
  reconcileAuthVersionProcessors,
  reconcileDefaultPoliciesProcessors
]);
