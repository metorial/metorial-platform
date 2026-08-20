import { combineQueueProcessors } from '@lowerdeck/queue';
import { deleteQueues } from './queues/delete';
import { reconcilerQueueProcessor } from './reconciler';
import { securityAuditQueueProcessor } from './queues/securityAudit';

export let callbackQueueProcessor = combineQueueProcessors([
  reconcilerQueueProcessor,
  deleteQueues,
  securityAuditQueueProcessor
]);
