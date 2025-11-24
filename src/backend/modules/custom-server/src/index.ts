import { combineQueueProcessors } from '@metorial/queue';
import { customServerCleanupCron } from './cron/cleanup';
import {
  lambdaDeployCheckerQueueProcessor,
  lambdaDeployCompleterQueueProcessor,
  lambdaDeployDiscoveryQueueProcessor,
  lambdaDeployFinalizerQueueProcessor,
  lambdaDeployMainQueueProcessor
} from './deployment/aws-lambda/queues';
import { denoDeployMainQueueProcessor } from './deployment/deno/queues/main';
import { checkRemoteQueueProcessor } from './queues/checkRemote';
import { indexCustomServerQueueProcessor } from './queues/indexServer';
import { initializeDockerQueueProcessor } from './queues/initializeDocker';
import { initializeLambdaQueueProcessor } from './queues/initializeLambda';
import { initializeRemoteQueueProcessor } from './queues/initializeRemote';
import { syncCurrentDraftBucketToRepoQueueProcessor } from './queues/syncCurrentDraftBucketToRepo';

export * from './services';
export * from './templates';

export let customServerQueueProcessor = combineQueueProcessors([
  customServerCleanupCron,
  checkRemoteQueueProcessor,
  denoDeployMainQueueProcessor,
  lambdaDeployMainQueueProcessor,
  initializeLambdaQueueProcessor,
  initializeRemoteQueueProcessor,
  lambdaDeployCheckerQueueProcessor,
  lambdaDeployCompleterQueueProcessor,
  syncCurrentDraftBucketToRepoQueueProcessor,
  lambdaDeployDiscoveryQueueProcessor,
  lambdaDeployFinalizerQueueProcessor,
  indexCustomServerQueueProcessor,
  initializeDockerQueueProcessor
]);
