import { runQueueProcessors } from '@lowerdeck/queue';
import { createChangeNotificationQueueProcessor } from './queues/changeNotification/create';
import { expiresConnectionsCron } from './queues/connection/expire';
import {
  offloadConnectionLogQueueProcessor,
  offloadConnectionLogsCron,
  offloadConnectionLogsQueueProcessor
} from './queues/connection/offload';
import { deployContainerServerWatchQueueProcessor } from './queues/container/monitor';
import { deployContainerServerStartQueueProcessor } from './queues/container/startDeployment';
import { deployServerFailedQueueProcessor } from './queues/deployment/failed';
import { deployServerSucceededQueueProcessor } from './queues/deployment/succeeded';
import { discoverRemoteOAuthConfigQueueProcessor } from './queues/discovery/remoteOAuthConfig';
import { discoverRemoteOAuthConnectionQueueProcessor } from './queues/discovery/remoteOAuthConnection';
import { discoverServerQueueProcessor } from './queues/discovery/server';
import { deployFunctionServerDiscoverQueueProcessor } from './queues/function/discover';
import { deployFunctionServerWatchQueueProcessor } from './queues/function/monitor';
import { deployFunctionServerPublishQueueProcessor } from './queues/function/publish';
import { deployFunctionServerStartQueueProcessor } from './queues/function/startDeployment';
import {
  serverCreatedQueueProcessor,
  serverUpdatedQueueProcessor
} from './queues/lifecycle/server';
import { serverVersionCreatedQueueProcessor } from './queues/lifecycle/serverVersion';
import { repositoryTagCreatedQueueProcessor } from './queues/lifecycle/tag';
import { delegatedOAuthErrorCheckQueueProcessor } from './queues/oauth/delegatedErrorCheck';
import { remoteOAuthErrorCheckQueueProcessor } from './queues/oauth/remoteErrorCheck';
import { retentionQueues } from './queues/retention';
import { deployRemoteServerStartQueueProcessor } from './queues/remote/startDeployment';
import {
  propagateRepoVersionToServerQueueProcessor,
  propagateRepoVersionToServersQueueProcessor
} from './queues/tag/serverVersion';
import {
  syncTagQueueProcessor,
  syncTagsCron,
  syncTagsQueueProcessor
} from './queues/tag/sync';

await runQueueProcessors([
  repositoryTagCreatedQueueProcessor,

  syncTagsCron,
  syncTagsQueueProcessor,
  syncTagQueueProcessor,

  propagateRepoVersionToServersQueueProcessor,
  propagateRepoVersionToServerQueueProcessor,

  createChangeNotificationQueueProcessor,

  discoverServerQueueProcessor,

  discoverRemoteOAuthConfigQueueProcessor,
  discoverRemoteOAuthConnectionQueueProcessor,

  delegatedOAuthErrorCheckQueueProcessor,
  remoteOAuthErrorCheckQueueProcessor,

  retentionQueues,

  expiresConnectionsCron,

  offloadConnectionLogsCron,
  offloadConnectionLogsQueueProcessor,
  offloadConnectionLogQueueProcessor,

  serverCreatedQueueProcessor,
  serverUpdatedQueueProcessor,

  serverVersionCreatedQueueProcessor,

  deployFunctionServerDiscoverQueueProcessor,
  deployFunctionServerWatchQueueProcessor,
  deployFunctionServerStartQueueProcessor,
  deployFunctionServerPublishQueueProcessor,

  deployContainerServerWatchQueueProcessor,
  deployContainerServerStartQueueProcessor,

  deployRemoteServerStartQueueProcessor,

  deployServerFailedQueueProcessor,
  deployServerSucceededQueueProcessor
]);
