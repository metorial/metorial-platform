import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  callbackReconcileInstanceQueueProcessor,
  callbackReconcileQueueProcessor
} from './queues/processors';
import { reconcileCallbackRegistrationQueueProcessor } from './queues/reconcileCallbackRegistration';
import {
  repairCallbackRegistrationsCron,
  repairCallbackRegistrationsQueueProcessor
} from './queues/repairCallbackRegistrations';
import {
  sweepCallbackLifecycleCron,
  sweepCallbackLifecycleInstancesQueueProcessor,
  sweepDeadDeploymentCallbacksQueueProcessor
} from './queues/sweepLifecycle';

export * from './lib/state';
export * from './lib/sync';
export * from './queues/definitions';
export * from './queues/processors';

export let reconcilerQueueProcessor = combineQueueProcessors([
  callbackReconcileQueueProcessor,
  callbackReconcileInstanceQueueProcessor,
  reconcileCallbackRegistrationQueueProcessor,
  repairCallbackRegistrationsQueueProcessor,
  repairCallbackRegistrationsCron,
  sweepDeadDeploymentCallbacksQueueProcessor,
  sweepCallbackLifecycleInstancesQueueProcessor,
  sweepCallbackLifecycleCron
]);
