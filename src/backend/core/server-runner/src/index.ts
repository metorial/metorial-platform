import { combineQueueProcessors } from '@metorial/queue';
import { checkRunnersProcessors } from './cron/check';

export * from './gateway';
export * from './services';

export let serverRunnerQueueProcessor = combineQueueProcessors([checkRunnersProcessors]);
