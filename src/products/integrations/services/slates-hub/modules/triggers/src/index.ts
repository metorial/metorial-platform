import { combineQueueProcessors } from '@lowerdeck/queue';
import { triggerQueues } from './queues/trigger';
import { webhookQueues } from './queues/webhook';

export let triggerQueueProcessor = combineQueueProcessors([webhookQueues, triggerQueues]);

export { startTriggerGatewayManager } from './internal/gateway';
