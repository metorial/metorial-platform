import { combineQueueProcessors } from '@lowerdeck/queue';
import { triggerRawEventCleanupQueueProcessor, triggerRawEventFailedSweepCron } from './cleanup';
import { triggerEventProcessQueueProcessor } from './eventProcess';
import { triggerRawEventIdempotencyKeyClearCron } from './idempotencyKeyClear';
import { triggerMapQueueProcessor } from './map';
import { triggerPollQueueProcessor } from './poll';
import { triggerRawEventMappingQueueProcessor } from './rawEventMapping';
import { triggerRegistrationCleanupQueueProcessor } from './registrationCleanup';
import { triggerRoutingMatcherResyncQueueProcessor } from './routingMatcherResync';
import {
  triggerScheduleReleaseStaleClaimsCron,
  triggerScheduleSearchCron,
  triggerScheduleSearchQueueProcessor
} from './schedule';
import { triggerRegistrationInstanceSetupQueueProcessor } from './setup';
import { triggerWebhookRegisterQueueProcessor } from './webhookRegister';
import { triggerWebhookRegistrationRematchQueueProcessor } from './webhookRegistrationRematch';
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
  triggerWebhookRegistrationRematchQueueProcessor,
  triggerWebhookUnregisterQueueProcessor,
  triggerRegistrationCleanupQueueProcessor,
  triggerRoutingMatcherResyncQueueProcessor,
  triggerRawEventMappingQueueProcessor,
  triggerMapQueueProcessor,
  triggerRawEventCleanupQueueProcessor,
  triggerRawEventFailedSweepCron,
  triggerRawEventIdempotencyKeyClearCron,
  triggerEventProcessQueueProcessor
]);
