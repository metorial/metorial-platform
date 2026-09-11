import { createQueue } from '@lowerdeck/queue';
import { type AttachmentRef } from '@metorial-subspace/adapter-chat';
import { addAfterTransactionHook, db } from '@metorial-subspace/db';
import { env } from '../../env';
import { chatMessageAttachmentInternalService } from '../../internal/chatMessageAttachment';
import { isUniqueConstraintError } from '../../lib/unique';

export type ChatMessageAttachmentSyncJob = {
  tenantId: string;
  environmentId: string;
  chatId: string;
  messageId: string;
  attachment: AttachmentRef;
  position: number;
};

export let chatMessageAttachmentSyncQueue = createQueue<ChatMessageAttachmentSyncJob>({
  name: 'sub/cht/attachment/sync',
  redisUrl: env.service.REDIS_URL
});

export let enqueueChatMessageAttachmentSync = (job: ChatMessageAttachmentSyncJob) =>
  addAfterTransactionHook(async () => {
    await chatMessageAttachmentSyncQueue.add(job);
  });

export let chatMessageAttachmentSyncQueueProcessor = chatMessageAttachmentSyncQueue.process(
  async data => {
    let [tenant, environment, message] = await Promise.all([
      db.tenant.findUnique({ where: { id: data.tenantId } }),
      db.environment.findUnique({ where: { id: data.environmentId } }),
      db.chatMessage.findUnique({ where: { id: data.messageId } })
    ]);
    if (!tenant || !environment || !message) return;

    let chat = await db.chat.findUnique({
      where: { id: data.chatId },
      include: { chatIntegrationInstanceProvider: true }
    });
    if (!chat) return;

    try {
      await chatMessageAttachmentInternalService.downloadChatMessageAttachment({
        tenant,
        environment,
        chat,
        message,
        attachment: data.attachment,
        position: data.position
      });
    } catch (err) {
      // Already materialized by a previous attempt at this job -- fine, not an error.
      if (!isUniqueConstraintError(err)) throw err;
    }
  }
);
