import { combineQueueProcessors } from '@metorial/queue';
import { syncUserUpdateQueueProcessor } from './queues/syncUserUpdate';
import { syncUserUpdateConsumerManyQueueProcessor } from './queues/syncUserUpdateToConsumers';
import {
  syncUserUpdateMemberManyQueueProcessor,
  syncUserUpdateMemberQueueProcessor
} from './queues/syncUserUpdateToMembers';

export { syncUserUpdateQueue } from './queues/syncUserUpdate';
export * from './services';

export let userQueueProcessor = combineQueueProcessors([
  syncUserUpdateQueueProcessor,

  syncUserUpdateMemberManyQueueProcessor,
  syncUserUpdateMemberQueueProcessor,

  syncUserUpdateConsumerManyQueueProcessor
]);
