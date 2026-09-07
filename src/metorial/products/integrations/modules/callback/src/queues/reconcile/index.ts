import { combineQueueProcessors } from '@lowerdeck/queue';
import { callbackReconcileQueueProcessor } from './callback';
import {
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
  callbackInstanceReconcileManyQueueProcessor,
  callbackInstanceReconcileQueueProcessor,
  callbackRetrySyncCron,
  callbackRetrySyncManyQueueProcessor,
  callbackInstanceRetrySyncManyQueueProcessor
]);
