import { combineQueueProcessors } from '@lowerdeck/queue';
import { processWebhookEventQueueProcessor } from './process';

export let webhookQueues = combineQueueProcessors([processWebhookEventQueueProcessor]);
