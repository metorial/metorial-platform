import { combineQueueProcessors } from '@lowerdeck/queue';
import { repositoryTagCreatedQueueProcessor } from './queues/lifecycle/tag';
import {
  syncTagsCron,
  syncTagsQueueProcessor,
  syncTagQueueProcessor
} from './queues/tag/sync';
import {
  propagateRepoVersionToServersQueueProcessor,
  propagateRepoVersionToServerQueueProcessor
} from './queues/tag/serverVersion';
import { serverVersionCreatedQueueProcessor } from './queues/lifecycle/serverVersion';
import { deployFunctionServerDiscoverQueueProcessor } from './queues/function/discover';
import { deployFunctionServerWatchQueueProcessor } from './queues/function/monitor';
import { deployFunctionServerStartQueueProcessor } from './queues/function/startDeployment';
import { deployFunctionServerPublishQueueProcessor } from './queues/function/publish';
import { deployContainerServerWatchQueueProcessor } from './queues/container/monitor';
import { deployContainerServerStartQueueProcessor } from './queues/container/startDeployment';
import { deployRemoteServerStartQueueProcessor } from './queues/remote/startDeployment';
import { deployServerFailedQueueProcessor } from './queues/deployment/failed';
import { deployServerSucceededQueueProcessor } from './queues/deployment/succeeded';
import {
  deployServerTimeoutCron,
  deployServerTimeoutManyQueueProcessor,
  deployServerTimeoutSingleQueueProcessor
} from './queues/deployment/timeout';

export * from './services';
export * from './services/serverDeploymentCreate';
export * from './queues/container/startDeployment';
export * from './queues/lifecycle/serverVersion';
export {
  propagateRepoVersionToServerQueueProcessor,
  propagateRepoVersionToServersQueueProcessor
} from './queues/tag/serverVersion';

export let deploymentsQueueProcessor = combineQueueProcessors([
  repositoryTagCreatedQueueProcessor,
  syncTagsCron,
  syncTagsQueueProcessor,
  syncTagQueueProcessor,
  propagateRepoVersionToServersQueueProcessor,
  propagateRepoVersionToServerQueueProcessor,
  serverVersionCreatedQueueProcessor,
  deployFunctionServerDiscoverQueueProcessor,
  deployFunctionServerWatchQueueProcessor,
  deployFunctionServerStartQueueProcessor,
  deployFunctionServerPublishQueueProcessor,
  deployContainerServerWatchQueueProcessor,
  deployContainerServerStartQueueProcessor,
  deployRemoteServerStartQueueProcessor,
  deployServerFailedQueueProcessor,
  deployServerSucceededQueueProcessor,
  deployServerTimeoutCron,
  deployServerTimeoutManyQueueProcessor,
  deployServerTimeoutSingleQueueProcessor
]);
