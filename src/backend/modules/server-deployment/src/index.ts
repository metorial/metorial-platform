import { combineQueueProcessors } from '@metorial/queue';
import { serverDeploymentDeletedQueueProcessor } from './queues/serverDeploymentDeleted';
import { serverDeploymentSetupQueueProcessor } from './queues/serverDeploymentSetup';
import { serverImplementationCreatedQueueProcessor } from './queues/serverImplementationCreated';

export * from './services';

export let serverDeploymentQueueProcessor = combineQueueProcessors([
  serverDeploymentSetupQueueProcessor,
  serverDeploymentDeletedQueueProcessor,
  serverImplementationCreatedQueueProcessor
]);
