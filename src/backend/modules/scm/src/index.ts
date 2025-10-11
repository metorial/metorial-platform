import { combineQueueProcessors } from '@metorial/queue';
import { createRepoWebhookQueueProcessor } from './queue/createRepoWebhook';
import {
  createHandleRepoPushForCustomServerQueueProcessor,
  createHandleRepoPushQueueProcessor
} from './queue/handleRepoPush';

export * from './services';
export * from './types';

export let scmQueueProcessor = combineQueueProcessors([
  createRepoWebhookQueueProcessor,
  createHandleRepoPushQueueProcessor,
  createHandleRepoPushForCustomServerQueueProcessor
]);
