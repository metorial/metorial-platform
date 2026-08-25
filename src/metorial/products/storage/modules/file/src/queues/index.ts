import { combineQueueProcessors } from '@metorial/queue';
import { fileCleanupProcessors } from './fileCleanup';
import { fileContentFlushProcessors } from './fileContentFlush';
import { fileExpirationProcessors } from './fileExpiration';
import { fileUploadCleanupProcessors } from './fileUploadCleanup';

export * from './fileCleanup';
export * from './fileContentFlush';
export * from './fileExpiration';
export * from './fileUploadCleanup';

export let fileQueueProcessor = combineQueueProcessors([
  fileCleanupProcessors,
  fileContentFlushProcessors,
  fileExpirationProcessors,
  fileUploadCleanupProcessors
]);
