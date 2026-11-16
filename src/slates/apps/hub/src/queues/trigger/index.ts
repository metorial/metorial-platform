import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  triggerDispatchCron,
  triggerDispatchQueueProcessor,
  triggerMappedDispatchQueueProcessor
} from './dispatch';
import {
  triggerWebhookExpandQueueProcessor,
  triggerWebhookExpansionCron,
  triggerWebhookExpansionSearchQueueProcessor
} from './webhookExpand';
import {
  triggerWebhookRenewCron,
  triggerWebhookRenewQueueProcessor,
  triggerWebhookRenewSearchQueueProcessor,
  triggerWebhookRenewResultCleanupQueueProcessor,
  triggerWebhookRenewResultSearchQueueProcessor
} from './webhookRenew';
import {
  triggerRawEventCleanupQueueProcessor,
  triggerRawEventFailedSweepCron,
  triggerRawEventFailedSweepQueueProcessor
} from './cleanup';
import { triggerEventProcessQueueProcessor } from './eventProcess';
import { triggerRawEventIdempotencyKeyClearCron } from './idempotencyKeyClear';
import { triggerMapQueueProcessor } from './map';
import {
  triggerEventPayloadOffloadQueueProcessor,
  triggerRawEventPayloadOffloadQueueProcessor
} from './payloadOffload';
import { triggerPollQueueProcessor } from './poll';
import { triggerRawEventMappingQueueProcessor } from './rawEventMapping';
import { triggerRegistrationCleanupQueueProcessor } from './registrationCleanup';
import { triggerRoutingMatcherResyncQueueProcessor } from './routingMatcherResync';
import { triggerScheduleSearchCron, triggerScheduleSearchQueueProcessor } from './schedule';
import { triggerRegistrationInstanceSetupQueueProcessor } from './setup';
import {
  triggerWebhookRediscoverCron,
  triggerWebhookRediscoverQueueProcessor
} from './webhookRediscover';
import { triggerWebhookRegisterQueueProcessor } from './webhookRegister';
import { triggerWebhookRegistrationRematchQueueProcessor } from './webhookRegistrationRematch';
import { triggerWebhookTargetLinkQueueProcessor } from './webhookTargetLink';
import { triggerWebhookTargetSearchQueueProcessor } from './webhookTargetSearch';
import {
  triggerWebhookTargetPruneQueueProcessor,
  triggerWebhookTargetSweepCron,
  triggerWebhookTargetSweepQueueProcessor
} from './webhookTargetSweep';
import { triggerWebhookUnregisterQueueProcessor } from './webhookUnregister';

export let triggerQueues = combineQueueProcessors([
  triggerDispatchCron,
  triggerDispatchQueueProcessor,
  triggerMappedDispatchQueueProcessor,
  triggerWebhookExpandQueueProcessor,
  triggerWebhookExpansionCron,
  triggerWebhookExpansionSearchQueueProcessor,
  triggerWebhookRenewCron,
  triggerWebhookRenewQueueProcessor,
  triggerWebhookRenewSearchQueueProcessor,
  triggerWebhookRenewResultCleanupQueueProcessor,
  triggerWebhookRenewResultSearchQueueProcessor,
  triggerScheduleSearchCron,
  triggerScheduleSearchQueueProcessor,
  triggerPollQueueProcessor,
  triggerRegistrationInstanceSetupQueueProcessor,
  triggerWebhookTargetSearchQueueProcessor,
  triggerWebhookRediscoverCron,
  triggerWebhookRediscoverQueueProcessor,
  triggerWebhookTargetSweepCron,
  triggerWebhookTargetSweepQueueProcessor,
  triggerWebhookTargetPruneQueueProcessor,
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
  triggerRawEventFailedSweepQueueProcessor,
  triggerRawEventIdempotencyKeyClearCron,
  triggerEventProcessQueueProcessor,
  triggerRawEventPayloadOffloadQueueProcessor,
  triggerEventPayloadOffloadQueueProcessor
]);
