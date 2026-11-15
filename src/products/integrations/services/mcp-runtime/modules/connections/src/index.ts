import { combineQueueProcessors } from '@lowerdeck/queue';
import { expiresConnectionsCron } from './queues/connection/expire';
import {
  offloadConnectionLogsCron,
  offloadConnectionLogsQueueProcessor,
  offloadConnectionLogQueueProcessor
} from './queues/connection/offload';

export * from './services';
export * from './services/serverConnection';

export let connectionsQueueProcessor = combineQueueProcessors([
  expiresConnectionsCron,
  offloadConnectionLogsCron,
  offloadConnectionLogsQueueProcessor,
  offloadConnectionLogQueueProcessor
]);
