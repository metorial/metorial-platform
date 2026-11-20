import './listeners/scope';
import { combineQueueProcessors } from '@metorial/queue';
import { reconcileQueueProcessor } from './queues/reconcile';
import { syncScopeQueueProcessor } from './queues/syncScope';

export { getAiGateway, isAiGatewayEnabled, type AiGateway } from './lib/client';
export * from './services/aiGatewayTenant';

export let aiGatewayQueueProcessor = combineQueueProcessors([
  syncScopeQueueProcessor,
  reconcileQueueProcessor
]);
