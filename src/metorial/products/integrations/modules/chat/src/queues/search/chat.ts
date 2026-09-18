import { createQueue } from '@lowerdeck/queue';
import { addAfterTransactionHook, db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';
import { indexChatChannelQueue } from './chatChannel';
import { indexChatWorkspaceQueue } from './chatWorkspace';

export let indexChatQueue = createQueue<{ chatId: string }>({
  name: 'sub/cht/sidx/chat',
  workerOpts: { concurrency: 50 },
  redisUrl: env.service.REDIS_URL
});

export let enqueueIndexChats = (chatIds: string[]) =>
  addAfterTransactionHook(async () => {
    await indexChatQueue.addMany(chatIds.map(chatId => ({ chatId })));
  });

export let indexChatQueueProcessor = indexChatQueue.process(async data => {
  let chat = await db.chat.findUnique({
    where: { id: data.chatId },
    include: {
      chatInstanceProvider: { include: { tenant: true } },
      chatConnection: true,
      chatInstance: true,
      workspace: true
    }
  });

  if (!chat || chat.status !== 'active' || chat.isParentDeleted) {
    await voyager.record.delete({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.chat.id,
      documentIds: [data.chatId]
    });
    return;
  }

  await voyager.record.index({
    sourceId: (await voyagerSource).id,
    indexId: voyagerIndex.chat.id,
    documentId: chat.id,
    tenantIds: [chat.chatInstanceProvider.tenant.id],
    fields: {
      chatId: chat.id,
      chatConnectionId: chat.chatConnection.id,
      chatInstanceId: chat.chatInstance.id,
      chatInstanceProviderId: chat.chatInstanceProvider.id
    },
    body: {
      name: chat.name,
      workspaceName: chat.workspace?.name,
      workspaceDomain: chat.workspace?.domain
    }
  });
});

export let indexChatChildrenManyQueue = createQueue<{
  parent:
    | { type: 'chatConnection'; id: string }
    | { type: 'chatInstance'; id: string }
    | { type: 'chatInstanceProvider'; id: string };
  cursor?: string;
}>({
  name: 'sub/cht/sidx/chatChildrenMany',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let enqueueIndexChatChildren = (
  parent:
    | { type: 'chatConnection'; id: string }
    | { type: 'chatInstance'; id: string }
    | { type: 'chatInstanceProvider'; id: string }
) =>
  addAfterTransactionHook(async () => {
    await indexChatChildrenManyQueue.add({ parent });
  });

export let indexChatChildrenManyQueueProcessor = indexChatChildrenManyQueue.process(
  async data => {
    let chats = await db.chat.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined,
        ...(data.parent.type === 'chatConnection'
          ? { chatConnection: { id: data.parent.id } }
          : data.parent.type === 'chatInstance'
            ? { chatInstance: { id: data.parent.id } }
            : { chatInstanceProvider: { id: data.parent.id } })
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: {
        id: true,
        workspace: { select: { id: true } },
        channels: { select: { id: true } }
      }
    });
    if (chats.length === 0) return;

    await indexChatQueue.addMany(chats.map(chat => ({ chatId: chat.id })));
    await indexChatWorkspaceQueue.addMany(
      chats.flatMap(chat => (chat.workspace ? [{ chatWorkspaceId: chat.workspace.id }] : []))
    );
    await indexChatChannelQueue.addMany(
      chats.flatMap(chat => chat.channels.map(channel => ({ chatChannelId: channel.id })))
    );

    if (chats.length === 100) {
      await indexChatChildrenManyQueue.add({
        parent: data.parent,
        cursor: chats[chats.length - 1]!.id
      });
    }
  }
);
