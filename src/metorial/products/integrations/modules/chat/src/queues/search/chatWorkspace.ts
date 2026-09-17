import { createQueue } from '@lowerdeck/queue';
import { addAfterTransactionHook, db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexChatWorkspaceQueue = createQueue<{ chatWorkspaceId: string }>({
  name: 'sub/cht/sidx/chatWorkspace',
  redisUrl: env.service.REDIS_URL
});

export let enqueueIndexChatWorkspaces = (chatWorkspaceIds: string[]) =>
  addAfterTransactionHook(async () => {
    await indexChatWorkspaceQueue.addMany(
      chatWorkspaceIds.map(chatWorkspaceId => ({ chatWorkspaceId }))
    );
  });

export let indexChatWorkspaceQueueProcessor = indexChatWorkspaceQueue.process(async data => {
  let chatWorkspace = await db.chatWorkspace.findUnique({
    where: { id: data.chatWorkspaceId },
    include: {
      chat: {
        include: { chatInstanceProvider: { include: { tenant: true } } }
      }
    }
  });

  if (
    !chatWorkspace ||
    chatWorkspace.chat.status !== 'active' ||
    chatWorkspace.chat.isParentDeleted
  ) {
    await voyager.record.delete({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.chatWorkspace.id,
      documentIds: [data.chatWorkspaceId]
    });
    return;
  }

  await voyager.record.index({
    sourceId: (await voyagerSource).id,
    indexId: voyagerIndex.chatWorkspace.id,
    documentId: chatWorkspace.id,
    tenantIds: [chatWorkspace.chat.chatInstanceProvider.tenant.id],
    fields: {
      chatWorkspaceId: chatWorkspace.id,
      chatId: chatWorkspace.chat.id,
      chatInstanceProviderId: chatWorkspace.chat.chatInstanceProvider.id
    },
    body: {
      name: chatWorkspace.name,
      domain: chatWorkspace.domain,
      chatName: chatWorkspace.chat.name
    }
  });
});
