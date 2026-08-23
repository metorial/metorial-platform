import { combineQueueProcessors } from '@metorial/queue';
import { fileCleanupProcessors } from './fileCleanup';
import { fileContentFlushProcessors } from './fileContentFlush';
import { fileExpirationProcessors } from './fileExpiration';

export * from './fileCleanup';
export * from './fileContentFlush';
export * from './fileExpiration';

export let fileQueueProcessor = combineQueueProcessors([
  fileCleanupProcessors,
  fileContentFlushProcessors,
  fileExpirationProcessors
]);
