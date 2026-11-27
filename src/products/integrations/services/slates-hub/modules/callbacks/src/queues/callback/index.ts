import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  callbackInstanceCleanupManyQueueProcessor,
  callbackInstanceCleanupSingleQueueProcessor
} from './cleanup';

export * from './cleanup';

export let callbackQueues = combineQueueProcessors([
  callbackInstanceCleanupManyQueueProcessor,
  callbackInstanceCleanupSingleQueueProcessor
]);
