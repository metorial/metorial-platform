import { combineQueueProcessors } from '@lowerdeck/queue';
import { cleanupCron } from './cron/cleanup';

export let catalogSubspaceQueueProcessor = combineQueueProcessors([]);

export let catalogFederationQueueProcessor = combineQueueProcessors([cleanupCron]);

export let catalogQueueProcessor = combineQueueProcessors([
  catalogSubspaceQueueProcessor,
  catalogFederationQueueProcessor
]);
