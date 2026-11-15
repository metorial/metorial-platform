import { combineQueueProcessors } from '@metorial/queue';
import { reconcileQueueProcessor } from './reconcile';
import { revokeTokensQueueProcessor } from './revokeTokens';
import { syncEntityQueueProcessor } from './syncEntity';
import { syncScopeQueueProcessor } from './syncScope';

export let agentTelemetryQueues = combineQueueProcessors([
  syncScopeQueueProcessor,
  syncEntityQueueProcessor,
  revokeTokensQueueProcessor,
  reconcileQueueProcessor
]);
