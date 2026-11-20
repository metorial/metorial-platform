import './listeners/scope';
import { combineQueueProcessors } from '@metorial/queue';
import { reconcileQueueProcessor } from './queues/reconcile';
import { syncScopeQueueProcessor } from './queues/syncScope';

export {
  getAiGateway,
  isAiGatewayEnabled,
  type AiGateway,
  type AiGatewayInferenceLog,
  type AiGatewayInstance,
  type AiGatewayProviderConnection,
  type AiGatewayToken,
  type AiGatewayVirtualModel
} from './lib/client';
export type { ScopedInstance } from './lib/scope';
export * from './services';

export let aiGatewayQueueProcessor = combineQueueProcessors([
  syncScopeQueueProcessor,
  reconcileQueueProcessor
]);
