import { combineQueueProcessors } from '@lowerdeck/queue';
import { cleanupCron } from './cron/cleanup';
import { deploymentConfigPairQueues } from './queues/deploymentConfigPair';
import { lifecycleQueues } from './queues/lifecycle';
import { listingQueues } from './queues/listing';
import { reconcilerQueues } from './queues/reconciler';
import { searchQueues } from './queues/search';
import { versionFederationQueues, versionSubspaceQueues } from './queues/version';

export let providerInternalSubspaceQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  deploymentConfigPairQueues,
  versionSubspaceQueues
]);

export let providerInternalFederationQueueProcessor = combineQueueProcessors([
  listingQueues,
  cleanupCron,
  versionFederationQueues,
  searchQueues,
  reconcilerQueues
]);

export let providerInternalQueueProcessor = combineQueueProcessors([
  providerInternalSubspaceQueueProcessor,
  providerInternalFederationQueueProcessor
]);
