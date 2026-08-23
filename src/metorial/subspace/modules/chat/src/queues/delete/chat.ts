import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { deleteChatsWhere } from '../../lib/chatLifecycle';
import { getCutoffDate } from './_config';

export let chatArchivedCleanupCron = createCron(
  {
    name: 'sub/cht/cron/chatArchivedCleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await chatDeleteManyQueue.add({}, { id: 'many' });
  }
);

export let chatDeleteManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/cht/delete/chat/many',
  redisUrl: env.service.REDIS_URL
});

export let chatDeleteManyQueueProcessor = chatDeleteManyQueue.process(async data => {
  let chats = await db.chat.findMany({
    where: {
      status: 'archived',
      archivedAt: { lt: getCutoffDate() },
      id: data.cursor ? { gt: data.cursor } : undefined
    },
    orderBy: { id: 'asc' },
    take: 100,
    select: { id: true }
  });
  if (chats.length === 0) return;

  await chatDeleteQueue.addMany(
    chats.map(chat => ({
      chatId: chat.id
    }))
  );

  let lastChat = chats[chats.length - 1];
  if (!lastChat) return;

  await chatDeleteManyQueue.add({
    cursor: lastChat.id
  });
});

export let chatDeleteQueue = createQueue<{ chatId: string }>({
  name: 'sub/cht/delete/chat',
  redisUrl: env.service.REDIS_URL
});

export let chatDeleteQueueProcessor = chatDeleteQueue.process(async data => {
  let chat = await db.chat.findUnique({
    where: { id: data.chatId }
  });
  if (!chat || chat.status !== 'archived') return;

  await deleteChatsWhere({ oid: chat.oid });
});
