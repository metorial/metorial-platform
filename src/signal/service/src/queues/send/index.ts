import { combineQueueProcessors } from '@lowerdeck/queue';
import { offloadCallbackEventPayloadQueueProcessor } from './callbackEventPayload';
import { eventCleanupQueueProcessor } from './cleanup';
import { attemptDeliveryQueueProcessor, createDeliveryQueueProcessor } from './delivery';
import { newEventQueueProcessor } from './init';
import {
  eventDeliveryRetryRepairCron,
  eventDeliveryRetryRepairQueueProcessor,
  eventInitializationRepairCron,
  eventInitializationRepairQueueProcessor
} from './repair';
import {
  intentEndedQueueProcessor,
  intentFailedQueueProcessor,
  intentSucceededQueueProcessor
} from './intent';
import { eventFailedQueueProcessor, eventSucceededQueueProcessor } from './lifecycle';

export let sendQueues = combineQueueProcessors([
  offloadCallbackEventPayloadQueueProcessor,
  newEventQueueProcessor,
  eventInitializationRepairCron,
  eventInitializationRepairQueueProcessor,
  eventDeliveryRetryRepairCron,
  eventDeliveryRetryRepairQueueProcessor,
  createDeliveryQueueProcessor,
  attemptDeliveryQueueProcessor,
  intentSucceededQueueProcessor,
  intentFailedQueueProcessor,
  eventFailedQueueProcessor,
  eventSucceededQueueProcessor,
  eventCleanupQueueProcessor,
  intentEndedQueueProcessor
]);
