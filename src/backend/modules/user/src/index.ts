import { combineQueueProcessors } from '@metorial/queue';
import {
  syncUserUpdateQueueProcessor,
  syncUserUpdateSingleQueueProcessor
} from './queues/syncUserUpdate';

export * from './services';

export let userQueueProcessor = combineQueueProcessors([
  syncUserUpdateQueueProcessor,
  syncUserUpdateSingleQueueProcessor
]);
