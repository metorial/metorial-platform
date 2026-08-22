import { combineQueueProcessors } from '@lowerdeck/queue';
import { chatMessageAttachmentSyncQueueProcessor } from './sync';

export let attachmentQueues = combineQueueProcessors([chatMessageAttachmentSyncQueueProcessor]);

export { enqueueChatMessageAttachmentSync } from './sync';
export type { ChatMessageAttachmentSyncJob } from './sync';
