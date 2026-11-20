import { runQueueProcessors } from '@lowerdeck/queue';
import { billingQueueProcessor } from '@mtsrc/ai-gateway-module-billing';
import { catalogQueueProcessor, onCatalogWorkerStart } from '@mtsrc/ai-gateway-module-catalog';
import {
  credentialsQueueProcessor,
  startPlatformConnectionChecks
} from '@mtsrc/ai-gateway-module-credentials';

await runQueueProcessors([
  catalogQueueProcessor,
  credentialsQueueProcessor,
  billingQueueProcessor
]);

startPlatformConnectionChecks();
await onCatalogWorkerStart();
