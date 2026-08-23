import { combineQueueProcessors } from '@metorial/queue';
import { materializeMagicMcpSessionOwnershipQueueProcessor } from './queues/materializeMagicMcpSessionOwnership';

export * from './services';
export { enqueueMaterializeMagicMcpSessionOwnership } from './queues/materializeMagicMcpSessionOwnership';

export let consumerEntitiesQueueProcessor = combineQueueProcessors([
  materializeMagicMcpSessionOwnershipQueueProcessor
]);
