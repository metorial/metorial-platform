import { combineQueueProcessors } from '@metorial/queue';
import { checkSessionsProcessors } from './cron/check';
import { serverSessionCreatedQueueProcessor } from './queue/serverSessionCreated';

export * from './connection';
export * from './services';

export let sessionQueueProcessor = combineQueueProcessors([
  checkSessionsProcessors,
  serverSessionCreatedQueueProcessor
]);
