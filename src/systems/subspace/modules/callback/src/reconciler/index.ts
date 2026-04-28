import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  callbackReconcileInstanceQueueProcessor,
  callbackReconcileQueueProcessor,
  callbackV2MigrationCallbackQueueProcessor,
  callbackV2MigrationScanQueueProcessor
} from './queues/processors';

export * from './lib/state';
export * from './lib/sync';
export * from './queues/definitions';
export * from './queues/processors';

export let reconcilerQueueProcessor = combineQueueProcessors([
  callbackReconcileQueueProcessor,
  callbackReconcileInstanceQueueProcessor,
  callbackV2MigrationScanQueueProcessor,
  callbackV2MigrationCallbackQueueProcessor
]);
