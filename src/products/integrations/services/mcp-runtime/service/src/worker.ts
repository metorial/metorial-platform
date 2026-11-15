import { runQueueProcessors } from '@lowerdeck/queue';
import { changeNotificationsQueueProcessor } from '@mtsrc/mcp-runtime-module-change-notifications';
import { connectionsQueueProcessor } from '@mtsrc/mcp-runtime-module-connections';
import { deploymentsQueueProcessor } from '@mtsrc/mcp-runtime-module-deployments';
import { discoveryQueueProcessor } from '@mtsrc/mcp-runtime-module-discovery';
import { oauthQueueProcessor } from '@mtsrc/mcp-runtime-module-oauth';
import { retentionQueueProcessor } from '@mtsrc/mcp-runtime-module-retention';
import { serversQueueProcessor } from '@mtsrc/mcp-runtime-module-servers';

await runQueueProcessors([
  changeNotificationsQueueProcessor,
  connectionsQueueProcessor,
  deploymentsQueueProcessor,
  discoveryQueueProcessor,
  oauthQueueProcessor,
  retentionQueueProcessor,
  serversQueueProcessor
]);
