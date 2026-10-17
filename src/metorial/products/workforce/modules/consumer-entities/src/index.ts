import { combineQueueProcessors } from '@metorial/queue';
import { consumerActorSyncProcessors } from './queues/consumerActorSync';
import { materializeMagicMcpSessionOwnershipQueueProcessor } from './queues/materializeMagicMcpSessionOwnership';

export * from './services';
export { syncInstanceConsumerActorsQueue } from './queues/consumerActorSync';
export { enqueueMaterializeMagicMcpSessionOwnership } from './queues/materializeMagicMcpSessionOwnership';

export let consumerEntitiesQueueProcessor = combineQueueProcessors([
  materializeMagicMcpSessionOwnershipQueueProcessor,
  consumerActorSyncProcessors
]);
