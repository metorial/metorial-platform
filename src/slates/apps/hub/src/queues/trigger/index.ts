import { combineQueueProcessors } from '@lowerdeck/queue';
import { triggerPollQueueProcessor } from './poll';
import {
  triggerScheduleReleaseStaleClaimsCron,
  triggerScheduleSearchCron,
  triggerScheduleSearchQueueProcessor
} from './schedule';
import { triggerRegistrationCleanupQueueProcessor } from './registrationCleanup';
import { triggerRegistrationInstanceSetupQueueProcessor } from './setup';
import { triggerWebhookRegisterQueueProcessor } from './webhookRegister';
import { triggerWebhookTargetLinkQueueProcessor } from './webhookTargetLink';
import { triggerWebhookTargetSearchQueueProcessor } from './webhookTargetSearch';
import { triggerWebhookUnregisterQueueProcessor } from './webhookUnregister';

export let triggerQueues = combineQueueProcessors([
  triggerScheduleSearchCron,
  triggerScheduleReleaseStaleClaimsCron,
  triggerScheduleSearchQueueProcessor,
  triggerPollQueueProcessor,
  triggerRegistrationInstanceSetupQueueProcessor,
  triggerWebhookTargetSearchQueueProcessor,
  triggerWebhookTargetLinkQueueProcessor,
  triggerWebhookRegisterQueueProcessor,
  triggerWebhookUnregisterQueueProcessor,
  triggerRegistrationCleanupQueueProcessor
]);
