import { withTransaction } from '@metorial-subspace/db';
import { enqueueChatMessageAttachmentCleanup } from '../queues/attachment/cleanup';

export type ChatLifecycleWhere = {
  oid?: bigint | { in: bigint[] };
  chatIntegrationOid?: bigint;
  chatIntegrationInstanceOid?: bigint | { in: bigint[] };
  chatIntegrationInstanceProviderOid?: bigint;
  chatIntegration?: { adapterIntegrationOid: bigint };
};

export let archiveChatsWhere = async (where: ChatLifecycleWhere, archivedAt = new Date()) => {
  return withTransaction(async db => {
    await db.chat.updateMany({
      where: {
        AND: [where, { status: { not: 'deleted' } }]
      },
      data: {
        status: 'archived',
        archivedAt,
        isParentDeleted: true
      }
    });
  });
};

export let restoreChatsWhere = async (where: ChatLifecycleWhere) => {
  return withTransaction(async db => {
    await db.chat.updateMany({
      where: {
        AND: [where, { status: 'archived' }]
      },
      data: {
        status: 'active',
        archivedAt: null,
        isParentDeleted: false
      }
    });
  });
};

export let deleteChatsWhere = async (where: ChatLifecycleWhere) => {
  while (true) {
    let done = await withTransaction(async db => {
      let chats = await db.chat.findMany({
        where: {
          AND: [where, { status: { not: 'deleted' } }]
        },
        take: 100,
        select: { oid: true }
      });
      if (chats.length === 0) return true;

      let chatOids = chats.map(chat => chat.oid);

      let messages = await db.chatMessage.findMany({
        where: { author: { chatOid: { in: chatOids } } },
        select: { oid: true }
      });
      let messageOids = messages.map(message => message.oid);
      let attachments = messageOids.length
        ? await db.chatMessageAttachment.findMany({
            where: { messageOid: { in: messageOids } },
            select: { fileId: true, uploadedFileId: true, uploadedFileReferenceId: true }
          })
        : [];

      await db.chatMessage.deleteMany({
        where: { oid: { in: messageOids } }
      });
      await enqueueChatMessageAttachmentCleanup(attachments);
      await db.chatThread.deleteMany({
        where: { chatOid: { in: chatOids } }
      });
      await db.chatChannel.deleteMany({
        where: { chatOid: { in: chatOids } }
      });
      await db.chatAuthor.deleteMany({
        where: { chatOid: { in: chatOids } }
      });
      await db.chatWorkspace.deleteMany({
        where: { chatOid: { in: chatOids } }
      });
      await db.chat.updateMany({
        where: { oid: { in: chatOids } },
        data: {
          status: 'deleted',
          name: '[deleted]',
          isParentDeleted: true
        }
      });

      return false;
    });
    if (done) return;
  }
};
