import { combineQueueProcessors } from '@lowerdeck/queue';
import { providerTelemetryErrorGroupsExportProcessors } from './queues/providerTelemetryErrorGroups';
import { deleteQueues } from './queues/delete';
import { lifecycleFederationQueues, lifecycleSubspaceQueues } from './queues/lifecycle';

export let sessionSubspaceQueueProcessor = combineQueueProcessors([lifecycleSubspaceQueues]);

export let sessionFederationQueueProcessor = combineQueueProcessors([
  lifecycleFederationQueues,
  deleteQueues,
  providerTelemetryErrorGroupsExportProcessors
]);

export let sessionQueueProcessor = combineQueueProcessors([
  sessionSubspaceQueueProcessor,
  sessionFederationQueueProcessor
]);
