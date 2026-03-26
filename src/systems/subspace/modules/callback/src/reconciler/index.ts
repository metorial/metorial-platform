import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  callbackReconcileQueueProcessor,
  callbackReconcileRegistrationAuditQueueProcessor,
  callbackReconcileRegistrationsPageQueueProcessor,
  callbackReconcileInstanceQueueProcessor,
  callbackReconcileInstancesPageQueueProcessor
} from './queues/processors';

export * from './lib/state';
export * from './lib/sync';
export * from './queues/definitions';
export * from './queues/processors';

export let reconcilerQueueProcessor = combineQueueProcessors([
  callbackReconcileQueueProcessor,
  callbackReconcileInstanceQueueProcessor,
  callbackReconcileInstancesPageQueueProcessor,
  callbackReconcileRegistrationsPageQueueProcessor,
  callbackReconcileRegistrationAuditQueueProcessor
]);
