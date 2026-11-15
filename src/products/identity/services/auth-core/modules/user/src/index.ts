import { combineQueueProcessors } from '@lowerdeck/queue';
import { userCleanupProcessor } from './cron/cleanup';

export * from './services/user';
export * from './services/userPassword';
export * from './services/userTwoFactor';

export let userQueueProcessor = combineQueueProcessors([userCleanupProcessor]);
