import { withTransaction } from '@metorial-subspace/db';

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

      await db.chatMessage.deleteMany({
        where: { author: { chatOid: { in: chatOids } } }
      });
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
