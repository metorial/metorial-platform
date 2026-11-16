import { combineQueueProcessors } from '@metorial/queue';
import { auditLogCleanupQueueProcessor } from './queues';

export * from './queues';
export * from './services';

export let auditLogQueueProcessor = combineQueueProcessors([auditLogCleanupQueueProcessor]);
