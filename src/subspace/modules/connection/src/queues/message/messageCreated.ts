import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { finalizeMessageQueue } from './finalizeMessage';
import { messageTimeoutQueue } from './messageTimeout';

export let messageCreatedQueue = createQueue<{ messageId: string }>({
  name: 'sub/con/msg/created',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 25 }
});

export let messageCreatedQueueProcessor = messageCreatedQueue.process(async data => {
  let message = await db.sessionMessage.findFirst({
    where: { id: data.messageId }
  });
  if (!message) throw new QueueRetryError();

  let incrementClientProductive = message.isProductive && message.source === 'client' ? 1 : 0;
  let incrementProviderProductive =
    message.isProductive && message.source === 'provider' ? 1 : 0;

  let incrementData: {
    totalProductiveClientMessageCount?: { increment: number };
    totalProductiveProviderMessageCount?: { increment: number };
  } = {};

  if (incrementClientProductive) {
    incrementData.totalProductiveClientMessageCount = { increment: 1 };
  }
  if (incrementProviderProductive) {
    incrementData.totalProductiveProviderMessageCount = { increment: 1 };
  }

  if (message.connectionOid) {
    await db.sessionConnection.updateMany({
      where: { oid: message.connectionOid },
      data: {
        lastActiveAt: new Date(),
        lastMessageAt: new Date(),
        ...incrementData
      }
    });
  }

  if (message.sessionProviderOid) {
    await db.sessionProvider.updateMany({
      where: { oid: message.sessionProviderOid },
      data: {
        lastMessageAt: new Date(),
        ...incrementData
      }
    });
  }

  await db.session.updateMany({
    where: { oid: message.sessionOid },
    data: {
      lastActiveAt: new Date(),
      lastMessageAt: new Date(),
      ...incrementData
    }
  });

  if (message.status == 'waiting_for_response') {
    await messageTimeoutQueue.add({ messageId: message.id }, { delay: 1000 * 15 });
  } else {
    await finalizeMessageQueue.add({ messageId: message.id });
  }
});
