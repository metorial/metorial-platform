import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  callbackReconcileCallbackQueueProcessor,
  callbackReconcileInstanceQueueProcessor,
  callbackReconcileQueueProcessor,
  callbackV2MigrationCallbackQueueProcessor,
  callbackV2MigrationScanQueueProcessor,
  reconcileCallbackRegistrationQueueProcessor,
  repairCallbackRegistrationsCron,
  repairCallbackRegistrationsQueueProcessor
} from './queues/processors';
import {
  sweepCallbackLifecycleCron,
  sweepCallbackLifecycleInstancesQueueProcessor,
  sweepDeadDeploymentCallbacksQueueProcessor
} from './queues/sweepLifecycle';

export * from './lib/state';
export * from './lib/sync';
export * from './queues/definitions';
export * from './queues/processors';
export * from './queues/sweepLifecycle';

export let reconcilerQueueProcessor = combineQueueProcessors([
  callbackReconcileQueueProcessor,
  callbackReconcileInstanceQueueProcessor,
  callbackReconcileCallbackQueueProcessor,
  callbackV2MigrationScanQueueProcessor,
  callbackV2MigrationCallbackQueueProcessor,
  reconcileCallbackRegistrationQueueProcessor,
  repairCallbackRegistrationsCron,
  repairCallbackRegistrationsQueueProcessor,
  sweepCallbackLifecycleCron,
  sweepDeadDeploymentCallbacksQueueProcessor,
  sweepCallbackLifecycleInstancesQueueProcessor
]);
