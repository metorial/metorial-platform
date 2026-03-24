import { combineQueueProcessors } from '@lowerdeck/queue';
import { expireSessionConnectionsQueues } from './connectionCleanup/expireSessionConnections';
import { expireSessionsCron } from './connectionCleanup/expireSessions';
import { createErrorQueueProcessor } from './error/createError';
import { createWarningQueueProcessor } from './error/createWarning';
import { finalizeMessageQueueProcessor } from './message/finalizeMessage';
import { messageCreatedQueueProcessor } from './message/messageCreated';
import { messageTimeoutQueueProcessor } from './message/messageTimeout';
import { offloadQueues } from './message/offloadMessage';
import { providerRunStartQueueProcessor } from './provderRun/providerRunStart';
import { stopProviderRunsCron } from './provderRun/stopProviderRuns';

export let queues = combineQueueProcessors([
  expireSessionConnectionsQueues,
  expireSessionsCron,
  messageTimeoutQueueProcessor,
  finalizeMessageQueueProcessor,
  offloadQueues,
  createErrorQueueProcessor,
  createWarningQueueProcessor,
  messageCreatedQueueProcessor,
  stopProviderRunsCron,
  providerRunStartQueueProcessor
]);
