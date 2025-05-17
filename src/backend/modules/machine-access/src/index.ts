import { combineQueueProcessors } from '@metorial/queue';
import { expiresApiKeysProcessors } from './cron/expireKeys';

export * from './services';

export let machineAccessQueueProcessor = combineQueueProcessors([expiresApiKeysProcessors]);
