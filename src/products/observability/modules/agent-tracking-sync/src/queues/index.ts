import { combineQueueProcessors } from '@metorial/queue';
import { backfillQueueProcessor } from './backfill';
import { reconcileQueueProcessor } from './reconcile';
import { syncEntityQueueProcessor } from './syncEntity';
import { syncScopeQueueProcessor } from './syncScope';

export let agentTrackingSyncQueueProcessor = combineQueueProcessors([
  syncScopeQueueProcessor,
  syncEntityQueueProcessor,
  reconcileQueueProcessor,
  backfillQueueProcessor
]);
