import { combineQueueProcessors } from '@lowerdeck/queue';
import { createRepoWebhookQueueProcessor } from './createRepoWebhook';
import { createHandleRepoPushQueueProcessor } from './handleRepoPush';
import { repositorySyncQueueProcessor } from './repositorySync';
import { reconcileRepoWebhooksProcessor } from './reconcileRepoWebhooks';

export let scmQueueProcessor = combineQueueProcessors([
  createHandleRepoPushQueueProcessor,
  createRepoWebhookQueueProcessor,
  repositorySyncQueueProcessor,
  reconcileRepoWebhooksProcessor
]);
