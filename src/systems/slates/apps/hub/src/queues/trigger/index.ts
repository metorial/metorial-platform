import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  slateTriggerPollQueueProcessor,
  slateTriggerPollingBatchQueueProcessor,
  slateTriggerPollingCron
} from './poll';
import { slateTriggerEventProcessQueueProcessor } from './process';
import {
  slateTriggerWebhookRegisterQueueProcessor,
  slateTriggerWebhookUnregisterQueueProcessor
} from './register';
import { slateTriggerEventSendQueueProcessor } from './send';
import { slateTriggerWebhookQueueProcessor } from './webhook';
import { slateTriggerEventInputArchiveQueueProcessor } from './archive';

export let triggerQueues = combineQueueProcessors([
  slateTriggerPollingCron,
  slateTriggerPollingBatchQueueProcessor,
  slateTriggerPollQueueProcessor,
  slateTriggerWebhookQueueProcessor,
  slateTriggerEventProcessQueueProcessor,
  slateTriggerEventSendQueueProcessor,
  slateTriggerEventInputArchiveQueueProcessor,
  slateTriggerWebhookRegisterQueueProcessor,
  slateTriggerWebhookUnregisterQueueProcessor
]);
