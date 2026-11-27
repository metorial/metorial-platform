import { createQueue } from '@lowerdeck/queue';
import { addAfterTransactionHook, db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexChatChannelQueue = createQueue<{ chatChannelId: string }>({
  name: 'sub/cht/sidx/chatChannel',
  workerOpts: { concurrency: 50 },
  redisUrl: env.service.REDIS_URL
});

export let enqueueIndexChatChannels = (chatChannelIds: string[]) =>
  addAfterTransactionHook(async () => {
    await indexChatChannelQueue.addMany(
      chatChannelIds.map(chatChannelId => ({ chatChannelId }))
    );
  });

export let indexChatChannelQueueProcessor = indexChatChannelQueue.process(async data => {
  let chatChannel = await db.chatChannel.findUnique({
    where: { id: data.chatChannelId },
    include: {
      chat: {
        include: { chatInstanceProvider: { include: { tenant: true } } }
      },
      workspace: true,
      recipient: true
    }
  });

  if (
    !chatChannel ||
    chatChannel.chat.status !== 'active' ||
    chatChannel.chat.isParentDeleted
  ) {
    await voyager.record.delete({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.chatChannel.id,
      documentIds: [data.chatChannelId]
    });
    return;
  }

  await voyager.record.index({
    sourceId: (await voyagerSource).id,
    indexId: voyagerIndex.chatChannel.id,
    documentId: chatChannel.id,
    tenantIds: [chatChannel.chat.chatInstanceProvider.tenant.id],
    fields: {
      chatChannelId: chatChannel.id,
      chatId: chatChannel.chat.id,
      workspaceId: chatChannel.workspace?.id,
      type: chatChannel.type,
      hasAccess: chatChannel.hasAccess
    },
    body: {
      name: chatChannel.name,
      topic: chatChannel.topic,
      subject: chatChannel.subject,
      workspaceName: chatChannel.workspace?.name,
      recipientName: chatChannel.recipient?.fullName,
      recipientUserName: chatChannel.recipient?.userName
    }
  });
});
