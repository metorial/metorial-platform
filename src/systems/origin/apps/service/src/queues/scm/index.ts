import { combineQueueProcessors } from '@lowerdeck/queue';
import { createRepoWebhookQueueProcessor } from './createRepoWebhook';
import { createHandleRepoPushQueueProcessor } from './handleRepoPush';

export let scmQueueProcessor = combineQueueProcessors([
  createHandleRepoPushQueueProcessor,
  createRepoWebhookQueueProcessor
]);
