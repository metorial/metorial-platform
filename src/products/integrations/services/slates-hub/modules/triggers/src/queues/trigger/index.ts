import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  triggerDispatchCron,
  triggerDispatchQueueProcessor,
  triggerMappedDispatchQueueProcessor
} from '../events/dispatch';
import {
  triggerWebhookExpandQueueProcessor,
  triggerWebhookExpansionCron,
  triggerWebhookExpansionSearchQueueProcessor
} from '../targets/webhookExpand';
import {
  triggerWebhookRenewCron,
  triggerWebhookRenewQueueProcessor,
  triggerWebhookRenewSearchQueueProcessor,
  triggerWebhookRenewResultCleanupQueueProcessor,
  triggerWebhookRenewResultSearchQueueProcessor
} from '../targets/webhookRenew';
import {
  triggerRawEventCleanupQueueProcessor,
  triggerRawEventFailedSweepCron,
  triggerRawEventFailedSweepQueueProcessor
} from '../events/cleanup';
import { triggerEventProcessQueueProcessor } from '../events/eventProcess';
import { triggerRawEventIdempotencyKeyClearCron } from '../events/idempotencyKeyClear';
import { triggerMapQueueProcessor } from '../events/map';
import {
  triggerEventPayloadOffloadQueueProcessor,
  triggerRawEventPayloadOffloadQueueProcessor
} from '../events/payloadOffload';
import { triggerPollQueueProcessor } from '../registration/poll';
import { triggerRawEventMappingQueueProcessor } from '../events/rawEventMapping';
import { triggerRegistrationCleanupQueueProcessor } from '../registration/registrationCleanup';
import {
  triggerScheduleSearchCron,
  triggerScheduleSearchQueueProcessor
} from '../registration/schedule';
import { triggerRegistrationInstanceSetupQueueProcessor } from '../registration/setup';
import {
  triggerWebhookRediscoverCron,
  triggerWebhookRediscoverQueueProcessor
} from '../targets/webhookRediscover';
import { triggerWebhookRegisterQueueProcessor } from '../targets/webhookRegister';
import { triggerWebhookRegistrationRematchQueueProcessor } from '../targets/webhookRegistrationRematch';
import { triggerWebhookTargetLinkQueueProcessor } from '../targets/webhookTargetLink';
import { triggerWebhookTargetSearchQueueProcessor } from '../targets/webhookTargetSearch';
import {
  triggerWebhookTargetPruneQueueProcessor,
  triggerWebhookTargetSweepCron,
  triggerWebhookTargetSweepQueueProcessor
} from '../targets/webhookTargetSweep';
import { triggerWebhookUnregisterQueueProcessor } from '../targets/webhookUnregister';

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
