import { combineQueueProcessors } from '@metorial/queue';
import {
  collectAuditEventsCron,
  processAuditEventQueueProcessor
} from './queues/processEvent';

export * from './queues/processEvent';
export * from './services';

export let auditTrackerQueueProcessor = combineQueueProcessors([
  collectAuditEventsCron,
  processAuditEventQueueProcessor
]);
