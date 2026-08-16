import { combineQueueProcessors } from '@metorial/queue';
import { fileCleanupProcessors } from './fileCleanup';
import { fileExpirationProcessors } from './fileExpiration';

export * from './fileCleanup';
export * from './fileExpiration';

export let fileQueueProcessor = combineQueueProcessors([
  fileCleanupProcessors,
  fileExpirationProcessors
]);
