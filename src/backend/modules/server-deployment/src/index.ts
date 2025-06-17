import { combineQueueProcessors } from '@metorial/queue';
import { serverDeploymentDeletedQueueProcessor } from './queues/serverDeploymentDeleted';
import { serverImplementationCreatedQueueProcessor } from './queues/serverImplementationCreated';

export * from './services';

export let serverDeploymentQueueProcessor = combineQueueProcessors([
  serverDeploymentDeletedQueueProcessor,
  serverImplementationCreatedQueueProcessor
]);
