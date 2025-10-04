import { combineQueueProcessors } from '@metorial/queue';
import {
  serverDeploymentIndexAllQueueProcessor,
  serverDeploymentIndexSingleQueueProcessor,
  serverImplementationIndexAllQueueProcessor,
  serverImplementationIndexSingleQueueProcessor,
  serverIndexCron
} from './queues/search';
import { serverDeploymentCreatedQueueProcessor } from './queues/serverDeploymentCreated';
import { serverDeploymentDeletedQueueProcessor } from './queues/serverDeploymentDeleted';
import { serverDeploymentSetupQueueProcessor } from './queues/serverDeploymentSetup';
import { serverImplementationCreatedQueueProcessor } from './queues/serverImplementationCreated';

export * from './services';

export { indexServerDeployments } from './queues/search';

export let serverDeploymentQueueProcessor = combineQueueProcessors([
  serverDeploymentSetupQueueProcessor,
  serverDeploymentDeletedQueueProcessor,
  serverImplementationCreatedQueueProcessor,
  serverDeploymentCreatedQueueProcessor,

  serverDeploymentIndexSingleQueueProcessor,
  serverDeploymentIndexAllQueueProcessor,
  serverImplementationIndexSingleQueueProcessor,
  serverImplementationIndexAllQueueProcessor,

  serverIndexCron
]);
