import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  serverCreatedQueueProcessor,
  serverUpdatedQueueProcessor
} from './queues/lifecycle/server';

export * from './services';

export let serversQueueProcessor = combineQueueProcessors([
  serverCreatedQueueProcessor,
  serverUpdatedQueueProcessor
]);
