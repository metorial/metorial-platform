import { combineQueueProcessors } from '@lowerdeck/queue';
import { connectionCleanupCron } from './cron/cleanup';
import { federationQueues, subspaceQueues } from './queues';

export let connectionSubspaceQueueProcessor = combineQueueProcessors([subspaceQueues]);

export let connectionFederationQueueProcessor = combineQueueProcessors([
  federationQueues,
  connectionCleanupCron
]);

export let connectionQueueProcessor = combineQueueProcessors([
  connectionSubspaceQueueProcessor,
  connectionFederationQueueProcessor
]);
