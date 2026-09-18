import { combineQueueProcessors } from '@lowerdeck/queue';
import { globalSlateWebhookEventCleanupProcessors } from './cleanup';
import { webhookEventPayloadOffloadQueueProcessor } from './payloadOffload';
import { processWebhookEventQueueProcessor } from './process';

export let webhookQueues = combineQueueProcessors([
  processWebhookEventQueueProcessor,
  webhookEventPayloadOffloadQueueProcessor,
  globalSlateWebhookEventCleanupProcessors
]);
