import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  callbackArchivedCleanupCron,
  callbackDeleteManyQueueProcessor,
  callbackDeleteQueueProcessor
} from './callback';
import {
  callbackInstanceArchivedCleanupCron,
  callbackInstanceDeleteManyQueueProcessor,
  callbackInstanceDeleteQueueProcessor
} from './callbackInstance';
import {
  webhookRegistrationArchivedCleanupCron,
  webhookRegistrationDeleteManyQueueProcessor,
  webhookRegistrationDeleteQueueProcessor
} from './webhookRegistration';

export let deleteQueues = combineQueueProcessors([
  callbackArchivedCleanupCron,
  callbackDeleteManyQueueProcessor,
  callbackDeleteQueueProcessor,
  callbackInstanceArchivedCleanupCron,
  callbackInstanceDeleteManyQueueProcessor,
  callbackInstanceDeleteQueueProcessor,
  webhookRegistrationArchivedCleanupCron,
  webhookRegistrationDeleteManyQueueProcessor,
  webhookRegistrationDeleteQueueProcessor
]);
