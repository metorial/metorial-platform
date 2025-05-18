import { combineQueueProcessors } from '@metorial/queue';
import { runnerQueueProcessors } from './broker/jobs';
import { checkRunnersProcessors } from './cron/check';
import { closeServerRunQueueProcessor } from './services/serverRun';

export * from './broker/client';
export * from './gateway';
export * from './services';

export let serverRunnerQueueProcessor = combineQueueProcessors([
  checkRunnersProcessors,
  runnerQueueProcessors,
  closeServerRunQueueProcessor
]);
