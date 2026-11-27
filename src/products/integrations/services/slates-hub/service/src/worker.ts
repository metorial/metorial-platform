import { runQueueProcessors } from '@lowerdeck/queue';
import { callbackQueueProcessor } from '@mtsrc/slates-hub-module-callbacks';
import { catalogQueueProcessor } from '@mtsrc/slates-hub-module-catalog';
import { errorQueueProcessor } from '@mtsrc/slates-hub-module-errors';
import {
  enqueueInstanceReconciliation,
  instanceQueueProcessor
} from '@mtsrc/slates-hub-module-instances';
import { invocationQueueProcessor } from '@mtsrc/slates-hub-module-invocations';
import { retentionQueueProcessor } from '@mtsrc/slates-hub-module-retention';
import { triggerRoutingQueueProcessor } from '@mtsrc/slates-hub-module-trigger-routing';
import {
  startTriggerGatewayManager,
  triggerQueueProcessor
} from '@mtsrc/slates-hub-module-triggers';

await enqueueInstanceReconciliation();

startTriggerGatewayManager();

await runQueueProcessors([
  invocationQueueProcessor,
  errorQueueProcessor,
  catalogQueueProcessor,
  instanceQueueProcessor,
  retentionQueueProcessor,
  triggerQueueProcessor,
  triggerRoutingQueueProcessor,
  callbackQueueProcessor
]);
