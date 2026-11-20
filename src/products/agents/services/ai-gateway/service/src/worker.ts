import { runQueueProcessors } from '@lowerdeck/queue';
import { catalogQueueProcessor, onCatalogWorkerStart } from '@mtsrc/ai-gateway-module-catalog';
import {
  credentialsQueueProcessor,
  startPlatformConnectionChecks
} from '@mtsrc/ai-gateway-module-credentials';

await runQueueProcessors([catalogQueueProcessor, credentialsQueueProcessor]);

startPlatformConnectionChecks();
await onCatalogWorkerStart();
