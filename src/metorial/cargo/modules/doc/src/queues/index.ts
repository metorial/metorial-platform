import { combineQueueProcessors } from '@lowerdeck/queue';
import { documentCollaborationFlushProcessors } from './documentCollaborationFlush';
import { documentCleanupProcessors } from './documentCleanup';
import { documentDraftVersionFlushProcessors } from './documentDraftVersionFlush';
import { documentFlushProcessors } from './documentFlush';
import { documentLifecycleProcessors } from './lifecycle';
import { documentVersionSyncProcessors } from './documentVersionSync';

export * from './documentCleanup';
export * from './documentCollaborationFlush';
export * from './documentDraftVersionFlush';
export * from './documentFlush';
export * from './lifecycle';
export * from './documentVersionSync';

export let documentQueueProcessor = combineQueueProcessors([
  documentLifecycleProcessors,
  documentFlushProcessors,
  documentCollaborationFlushProcessors,
  documentDraftVersionFlushProcessors,
  documentCleanupProcessors,
  documentVersionSyncProcessors
]);
