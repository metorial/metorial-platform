import { combineQueueProcessors } from '@lowerdeck/queue';
import { globalSlateWebhookEventCleanupCron } from './cleanup';
import { webhookEventPayloadOffloadQueueProcessor } from './payloadOffload';
import { processWebhookEventQueueProcessor } from './process';

export let webhookQueues = combineQueueProcessors([
  processWebhookEventQueueProcessor,
  webhookEventPayloadOffloadQueueProcessor,
  globalSlateWebhookEventCleanupCron
]);
