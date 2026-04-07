import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  callbackReconcileInstanceQueueProcessor,
  callbackReconcileInstancesPageQueueProcessor,
  callbackReconcileQueueProcessor,
  callbackReconcileRegistrationAuditQueueProcessor,
  callbackReconcileRegistrationsPageQueueProcessor
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
