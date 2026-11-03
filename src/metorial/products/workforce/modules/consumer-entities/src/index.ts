import { combineQueueProcessors } from '@metorial/queue';
import { deletedConsumerProfileProcessors } from './queues/deletedConsumerProfile';
import { consumerActorSyncProcessors } from './queues/consumerActorSync';
import { materializeMagicMcpSessionOwnershipQueueProcessor } from './queues/materializeMagicMcpSessionOwnership';

export * from './services';
export * from './lib/consumerSkillSource';
export * from './lib/skillEditingTools';
export { archiveDeletedConsumerProfileActorsQueue } from './queues/deletedConsumerProfile';
export { syncInstanceConsumerActorsQueue } from './queues/consumerActorSync';
export { enqueueMaterializeMagicMcpSessionOwnership } from './queues/materializeMagicMcpSessionOwnership';

export let consumerEntitiesQueueProcessor = combineQueueProcessors([
  materializeMagicMcpSessionOwnershipQueueProcessor,
  consumerActorSyncProcessors,
  deletedConsumerProfileProcessors
]);
