import { combineQueueProcessors } from '@lowerdeck/queue';
import { providerTelemetryErrorGroupsExportProcessors } from './queues/providerTelemetryErrorGroups';
import { deleteQueues } from './queues/delete';
import { lifecycleQueues } from './queues/lifecycle';

export let sessionQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  deleteQueues,
  providerTelemetryErrorGroupsExportProcessors
]);
