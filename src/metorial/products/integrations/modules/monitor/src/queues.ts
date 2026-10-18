import { combineQueueProcessors } from '@lowerdeck/queue';
import { reconcileQueues } from './queues/reconcile';
import {
  schemaChangeFederationProcessors,
  schemaChangeQueueProcessors,
  schemaChangeSubspaceProcessors
} from './queues/schemaChange';

export let monitorSubspaceQueueProcessor = combineQueueProcessors([
  schemaChangeSubspaceProcessors
]);

export let monitorFederationQueueProcessor = combineQueueProcessors([
  reconcileQueues,
  schemaChangeFederationProcessors
]);

export let monitorQueueProcessor = combineQueueProcessors([
  reconcileQueues,
  schemaChangeQueueProcessors
]);
