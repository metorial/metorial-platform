import { combineQueueProcessors } from '@metorial/queue';
import { documentAnnotationsRepairProcessors } from './documentAnnotationsRepair';
import { documentCleanupProcessors } from './documentCleanup';
import { documentCollaborationFlushProcessors } from './documentCollaborationFlush';
import { documentCommentAnchorSyncProcessors } from './documentCommentAnchorSync';
import { documentDraftVersionFlushProcessors } from './documentDraftVersionFlush';
import { documentFlushProcessors } from './documentFlush';
import { documentVersionSealProcessors } from './documentVersionSeal';
import { documentVersionSyncProcessors } from './documentVersionSync';
import { documentLifecycleProcessors } from './lifecycle';

export * from './documentAnnotationsRepair';
export * from './documentCleanup';
export * from './documentCollaborationFlush';
export * from './documentCommentAnchorSync';
export * from './documentDraftVersionFlush';
export * from './documentFlush';
export * from './documentVersionSeal';
export * from './documentVersionSync';
export * from './lifecycle';

export let documentQueueProcessor = combineQueueProcessors([
  documentLifecycleProcessors,
  documentFlushProcessors,
  documentCollaborationFlushProcessors,
  documentDraftVersionFlushProcessors,
  documentCleanupProcessors,
  documentVersionSealProcessors,
  documentVersionSyncProcessors,
  documentAnnotationsRepairProcessors,
  documentCommentAnchorSyncProcessors
]);
