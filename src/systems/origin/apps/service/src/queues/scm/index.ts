import { combineQueueProcessors } from '@mtsrc/queue';
import { createRepoWebhookQueueProcessor } from './createRepoWebhook';
import { createHandleRepoPushQueueProcessor } from './handleRepoPush';
import { repositorySyncQueueProcessor } from './repositorySync';

export let scmQueueProcessor = combineQueueProcessors([
  createHandleRepoPushQueueProcessor,
  createRepoWebhookQueueProcessor,
  repositorySyncQueueProcessor
]);
