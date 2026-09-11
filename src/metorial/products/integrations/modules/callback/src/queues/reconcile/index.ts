import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  callbackReconcileForIntegrationManyQueueProcessor,
  callbackReconcileQueueProcessor
} from './callback';
import {
  callbackInstanceReconcileForIntegrationInstanceManyQueueProcessor,
  callbackInstanceReconcileManyQueueProcessor,
  callbackInstanceReconcileQueueProcessor
} from './callbackInstance';
import {
  callbackInstanceRetrySyncManyQueueProcessor,
  callbackRetrySyncCron,
  callbackRetrySyncManyQueueProcessor
} from './retrySync';

export * from './callback';
export * from './callbackInstance';
export * from './retrySync';

export let reconcileQueues = combineQueueProcessors([
  callbackReconcileQueueProcessor,
  callbackReconcileForIntegrationManyQueueProcessor,
  callbackInstanceReconcileManyQueueProcessor,
  callbackInstanceReconcileForIntegrationInstanceManyQueueProcessor,
  callbackInstanceReconcileQueueProcessor,
  callbackRetrySyncCron,
  callbackRetrySyncManyQueueProcessor,
  callbackInstanceRetrySyncManyQueueProcessor
]);
