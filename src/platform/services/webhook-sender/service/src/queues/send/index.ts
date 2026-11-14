import { combineQueueProcessors } from '@lowerdeck/queue';
import { offloadCallbackEventPayloadQueueProcessor } from './callbackEventPayload';
import { eventCleanupQueueProcessor } from './cleanup';
import { attemptDeliveryQueueProcessor, createDeliveryQueueProcessor } from './delivery';
import { newEventQueueProcessor } from './init';
import {
  intentEndedQueueProcessor,
  intentFailedQueueProcessor,
  intentSucceededQueueProcessor
} from './intent';
import { eventFailedQueueProcessor, eventSucceededQueueProcessor } from './lifecycle';

export let sendQueues = combineQueueProcessors([
  offloadCallbackEventPayloadQueueProcessor,
  newEventQueueProcessor,
  createDeliveryQueueProcessor,
  attemptDeliveryQueueProcessor,
  intentSucceededQueueProcessor,
  intentFailedQueueProcessor,
  eventFailedQueueProcessor,
  eventSucceededQueueProcessor,
  eventCleanupQueueProcessor,
  intentEndedQueueProcessor
]);
