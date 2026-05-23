import { combineQueueProcessors } from '@mtsrc/queue';
import { registrySyncCron, syncRegistryAllQueueProcessor } from './cron';
import { syncRegistryQueueProcessor } from './syncRegistry';
import { deploySlateAfterSyncQueueProcessor, syncSlateQueueProcessor } from './syncSlate';

export let registryQueues = combineQueueProcessors([
  registrySyncCron,
  syncRegistryAllQueueProcessor,
  syncRegistryQueueProcessor,
  syncSlateQueueProcessor,
  deploySlateAfterSyncQueueProcessor
]);
