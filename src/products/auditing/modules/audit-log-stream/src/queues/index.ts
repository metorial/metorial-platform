import { combineQueueProcessors } from '@metorial/queue';
import { cleanupAuditLogStreamRunsCron } from './cleanup';
import {
  scavengeDirtyAuditLogOrganizationsCron,
  scavengeDirtyAuditLogOrganizationsQueueProcessor,
  syncAuditLogStreamQueueProcessor
} from './sync';

export * from './sync';

export let auditLogStreamQueueProcessor = combineQueueProcessors([
  scavengeDirtyAuditLogOrganizationsCron,
  scavengeDirtyAuditLogOrganizationsQueueProcessor,
  syncAuditLogStreamQueueProcessor,
  cleanupAuditLogStreamRunsCron
]);
