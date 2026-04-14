import { combineQueueProcessors } from '@lowerdeck/queue';
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
