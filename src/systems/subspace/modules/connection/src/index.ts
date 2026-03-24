import { combineQueueProcessors } from '@lowerdeck/queue';
import { connectionCleanupCron } from './cron/cleanup';
import { queues } from './queues';

export let connectionQueueProcessor = combineQueueProcessors([queues, connectionCleanupCron]);

export * from './controller';
export * from './mcp';
export * from './presenter';
export * from './sender';
