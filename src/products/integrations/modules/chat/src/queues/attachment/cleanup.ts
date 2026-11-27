import { createQueue } from '@lowerdeck/queue';
import { addAfterTransactionHook } from '@metorial-subspace/db';
import { env } from '../../env';
import { chatMessageAttachmentInternalService } from '../../internal/chatMessageAttachment';

export type ChatMessageAttachmentCleanupJob = {
  fileId: string;
  uploadedFileId?: string | null;
  uploadedFileReferenceId?: string | null;
};

export let chatMessageAttachmentCleanupQueue = createQueue<ChatMessageAttachmentCleanupJob>({
  name: 'sub/cht/attachment/cleanup',
  redisUrl: env.service.REDIS_URL
});

export let enqueueChatMessageAttachmentCleanup = (jobs: ChatMessageAttachmentCleanupJob[]) => {
  if (!jobs.length) return;

  return addAfterTransactionHook(async () => {
    await chatMessageAttachmentCleanupQueue.addMany(jobs);
  });
};

export let chatMessageAttachmentCleanupQueueProcessor = chatMessageAttachmentCleanupQueue.process(
  async data => {
    await chatMessageAttachmentInternalService.cleanupAttachmentFiles(data);
  }
);
