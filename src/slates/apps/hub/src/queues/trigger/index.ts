import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  slateTriggerPollQueueProcessor,
  slateTriggerPollingBatchQueueProcessor,
  slateTriggerPollingCron
} from './poll';
import { slateTriggerEventProcessQueueProcessor } from './process';
import {
  slateTriggerReceiverFinalCleanupCron,
  slateTriggerReceiverFinalCleanupQueueProcessor,
  slateTriggerWebhookRegisterQueueProcessor,
  slateTriggerWebhookRegistrationRepairCron,
  slateTriggerWebhookRegistrationRepairQueueProcessor,
  slateTriggerWebhookRenewalCron,
  slateTriggerWebhookRetiringCleanupQueueProcessor,
  slateTriggerWebhookUnregisterQueueProcessor
} from './register';
import {
  slateTriggerEventSendQueueProcessor,
  slateTriggerWebhookDispatchOutboxQueueProcessor
} from './send';
import { slateTriggerWebhookQueueProcessor } from './webhook';
import { slateTriggerEventInputArchiveQueueProcessor } from './archive';
import {
  slateTriggerCleanupCron,
  slateTriggerCleanupManyQueueProcessor,
  slateTriggerCleanupSingleQueueProcessor
} from './cleanup';
import {
  slateTriggerWebhookPayloadCleanupCron,
  slateTriggerWebhookPayloadCleanupQueueProcessor
} from './webhookPayloadCleanup';
import {
  slateTriggerWebhookReplayCleanupCron,
  slateTriggerWebhookReplayCleanupQueueProcessor
} from './webhookReplayCleanup';

export let triggerQueues = combineQueueProcessors([
  slateTriggerPollingCron,
  slateTriggerPollingBatchQueueProcessor,
  slateTriggerPollQueueProcessor,
  slateTriggerWebhookQueueProcessor,
  slateTriggerWebhookPayloadCleanupCron,
  slateTriggerWebhookPayloadCleanupQueueProcessor,
  slateTriggerWebhookReplayCleanupCron,
  slateTriggerWebhookReplayCleanupQueueProcessor,
  slateTriggerEventProcessQueueProcessor,
  slateTriggerEventSendQueueProcessor,
  slateTriggerWebhookDispatchOutboxQueueProcessor,
  slateTriggerEventInputArchiveQueueProcessor,
  slateTriggerCleanupCron,
  slateTriggerCleanupManyQueueProcessor,
  slateTriggerCleanupSingleQueueProcessor,
  slateTriggerWebhookRegisterQueueProcessor,
  slateTriggerWebhookUnregisterQueueProcessor,
  slateTriggerWebhookRetiringCleanupQueueProcessor,
  slateTriggerWebhookRegistrationRepairCron,
  slateTriggerWebhookRegistrationRepairQueueProcessor,
  slateTriggerWebhookRenewalCron,
  slateTriggerReceiverFinalCleanupCron,
  slateTriggerReceiverFinalCleanupQueueProcessor
]);
