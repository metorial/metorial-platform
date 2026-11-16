import { combineQueueProcessors } from '@lowerdeck/queue';
import { auditCleanupCron } from './cron/cleanup';

export * from './services/auditLog';

export let auditQueueProcessor = combineQueueProcessors([auditCleanupCron]);
