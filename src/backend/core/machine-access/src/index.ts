import { combineQueueProcessors } from '@metorial/queue';
import { expiresApiKeysProcessors } from './cron/expiresKeys';

export * from './definitions';
export * from './services';

export let machineAccessQueueProcessor = combineQueueProcessors([expiresApiKeysProcessors]);
