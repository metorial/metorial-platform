import { combineQueueProcessors } from '@lowerdeck/queue';
import { chatMessageAttachmentCleanupQueueProcessor } from './cleanup';
import { chatMessageAttachmentSyncQueueProcessor } from './sync';

export let attachmentQueues = combineQueueProcessors([
  chatMessageAttachmentSyncQueueProcessor,
  chatMessageAttachmentCleanupQueueProcessor
]);

export { enqueueChatMessageAttachmentCleanup } from './cleanup';
export type { ChatMessageAttachmentCleanupJob } from './cleanup';
export { enqueueChatMessageAttachmentSync } from './sync';
export type { ChatMessageAttachmentSyncJob } from './sync';
