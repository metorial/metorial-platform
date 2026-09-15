import { combineQueueProcessors } from '@lowerdeck/queue';
import { indexChatConnectionQueueProcessor } from './chatConnection';
import { indexChatInstanceQueueProcessor } from './chatInstance';

export let searchQueues = combineQueueProcessors([
  indexChatConnectionQueueProcessor,
  indexChatInstanceQueueProcessor
]);
