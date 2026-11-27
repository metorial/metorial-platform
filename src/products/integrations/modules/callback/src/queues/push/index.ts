import { combineQueueProcessors } from '@lowerdeck/queue';
import { callbackPushQueueProcessor } from './callback';
import { callbackInstancePushQueueProcessor } from './callbackInstance';

export * from './callback';
export * from './callbackInstance';

export let pushQueues = combineQueueProcessors([
  callbackPushQueueProcessor,
  callbackInstancePushQueueProcessor
]);
