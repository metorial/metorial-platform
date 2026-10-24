import { combineQueueProcessors } from '@lowerdeck/queue';
import { persistMessageScanQueueProcessor } from './queues/persistMessageScan';
import { toolScanQueueProcessors } from './queues/toolScan';

export * from './services';

export let protoGuardQueueProcessor = combineQueueProcessors([
  persistMessageScanQueueProcessor,
  toolScanQueueProcessors
]);
