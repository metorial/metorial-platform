import { combineQueueProcessors } from '@lowerdeck/queue';
import { callbackEventProcessQueueProcessor } from './queues/processEvent';

export let callbackQueueProcessor = combineQueueProcessors([
  callbackEventProcessQueueProcessor
]);
