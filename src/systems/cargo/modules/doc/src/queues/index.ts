import { combineQueueProcessors } from '@lowerdeck/queue';
import { documentCleanupProcessors } from './documentCleanup';
import { documentDraftVersionFlushProcessors } from './documentDraftVersionFlush';
import { documentFlushProcessors } from './documentFlush';
import { documentVersionSyncProcessors } from './documentVersionSync';

export * from './documentCleanup';
export * from './documentDraftVersionFlush';
export * from './documentFlush';
export * from './documentVersionSync';

export let documentQueueProcessor = combineQueueProcessors([
  documentFlushProcessors,
  documentDraftVersionFlushProcessors,
  documentCleanupProcessors,
  documentVersionSyncProcessors
]);
