import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { subDays } from 'date-fns';
import { env } from '../../env';

let getDeletedMessageCutoffDate = () => subDays(new Date(), 5);

export let chatMessageDeletedCleanupCron = createCron(
  {
    name: 'sub/cht/cron/deletedMessageCleanup',
    cron: '0 1 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await chatMessageDeleteManyQueue.add({}, { id: 'many' });
  }
);

export let chatMessageDeleteManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/cht/delete/chatMessage/many',
  redisUrl: env.service.REDIS_URL
});

export let chatMessageDeleteManyQueueProcessor = chatMessageDeleteManyQueue.process(
  async data => {
    let messages = await db.chatMessage.findMany({
      where: {
        deletedAt: { lt: getDeletedMessageCutoffDate() },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (messages.length === 0) return;

    await chatMessageDeleteQueue.addMany(messages.map(message => ({ messageId: message.id })));

    let lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    await chatMessageDeleteManyQueue.add({ cursor: lastMessage.id });
  }
);

export let chatMessageDeleteQueue = createQueue<{ messageId: string }>({
  name: 'sub/cht/delete/chatMessage',
  redisUrl: env.service.REDIS_URL
});

export let chatMessageDeleteQueueProcessor = chatMessageDeleteQueue.process(async data => {
  let message = await db.chatMessage.findUnique({
    where: { id: data.messageId },
    select: { oid: true, deletedAt: true }
  });
  if (!message?.deletedAt || message.deletedAt >= getDeletedMessageCutoffDate()) return;

  await db.chatMessage.delete({ where: { oid: message.oid } });
});
