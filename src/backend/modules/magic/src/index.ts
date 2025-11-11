import { combineQueueProcessors } from '@metorial/queue';
import { syncMagicMcpGroupQueueProcessor } from './queues/syncGroup';
import { syncMagicMcpServerQueueProcessor } from './queues/syncServer';

export * from './services';

export let magicQueueProcessor = combineQueueProcessors([
  syncMagicMcpGroupQueueProcessor,
  syncMagicMcpServerQueueProcessor
]);
