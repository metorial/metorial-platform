import { combineQueueProcessors } from '@metorial/queue';
import { backfillConsumerAccessLevelCron } from './cron/backfillAccessLevel';
import { cleanupOrphanedSkillPluginAccessCron } from './cron/cleanupOrphanedSkillPluginAccess';
import { sendApprovedConsumerAccessRequestEmailQueueProcessor } from './queues/accessRequest/sendApprovedConsumerAccessRequestEmail';
import { sendRejectedConsumerAccessRequestEmailQueueProcessor } from './queues/accessRequest/sendRejectedConsumerAccessRequestEmail';
import {
  consumerAccessDeleteQueueProcessor,
  consumerAccessListingDeleteQueueProcessor,
  consumerTargetAccessCleanupManyQueueProcessor
} from './queues/lifecycle/consumerAccessCleanup';
import {
  consumerAccessRequestCreatedQueueProcessor,
  consumerAccessRequestUpdatedQueueProcessor
} from './queues/lifecycle/consumerAccessRequest';
import { indexConsumerAccessRequestSearchQueueProcessor } from './queues/search/consumerAccessRequest';

export * from './services';
export { enqueueConsumerTargetAccessCleanup } from './queues/lifecycle/consumerAccessCleanup';

export let consumerAccessQueueProcessor = combineQueueProcessors([
  indexConsumerAccessRequestSearchQueueProcessor,
  sendApprovedConsumerAccessRequestEmailQueueProcessor,
  sendRejectedConsumerAccessRequestEmailQueueProcessor,
  consumerTargetAccessCleanupManyQueueProcessor,
  consumerAccessListingDeleteQueueProcessor,
  consumerAccessDeleteQueueProcessor,
  consumerAccessRequestCreatedQueueProcessor,
  consumerAccessRequestUpdatedQueueProcessor,
  backfillConsumerAccessLevelCron,
  cleanupOrphanedSkillPluginAccessCron
]);
