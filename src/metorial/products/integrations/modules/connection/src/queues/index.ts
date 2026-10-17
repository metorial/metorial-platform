import { combineQueueProcessors } from '@lowerdeck/queue';
import { expireSessionConnectionsQueues } from './connectionCleanup/expireSessionConnections';
import { expireSessionsQueues } from './connectionCleanup/expireSessions';
import { createErrorQueueProcessor } from './error/createError';
import { createWarningQueueProcessor } from './error/createWarning';
import { finalizeMessageQueueProcessor } from './message/finalizeMessage';
import { messageCreatedQueueProcessor } from './message/messageCreated';
import { messageTimeoutQueueProcessor } from './message/messageTimeout';
import { offloadQueues } from './message/offloadMessage';
import { protoGuardMessageQueueProcessor } from './message/protoGuard';
import { providerRunStartQueueProcessor } from './provderRun/providerRunStart';
import { stopProviderRunsQueues } from './provderRun/stopProviderRuns';

export let queues = combineQueueProcessors([
  expireSessionConnectionsQueues,
  expireSessionsQueues,
  messageTimeoutQueueProcessor,
  finalizeMessageQueueProcessor,
  protoGuardMessageQueueProcessor,
  offloadQueues,
  createErrorQueueProcessor,
  createWarningQueueProcessor,
  messageCreatedQueueProcessor,
  stopProviderRunsQueues,
  providerRunStartQueueProcessor
]);
