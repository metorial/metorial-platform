import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  webhookRegistrationArchivedCleanupCron,
  webhookRegistrationDeleteManyQueueProcessor,
  webhookRegistrationDeleteQueueProcessor
} from './webhookRegistration';

export let deleteQueues = combineQueueProcessors([
  webhookRegistrationArchivedCleanupCron,
  webhookRegistrationDeleteManyQueueProcessor,
  webhookRegistrationDeleteQueueProcessor
]);
