import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { v7 } from 'uuid';
import { env } from '../../env';

export let finalizeMessageQueue = createQueue<{ messageId: string }>({
  name: 'sub/con/msg/fin',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

export let finalizeMessageQueueProcessor = finalizeMessageQueue.process(async data => {
  let message = await db.sessionMessage.findFirst({
    where: { id: data.messageId },
    include: { session: true }
  });
  if (!message) return;

  let initialClientProductive = message.isProductive && message.source === 'client' ? 1 : 0;
  let initialProviderProductive =
    message.isProductive && message.source === 'provider' ? 1 : 0;

  let incrementProviderProductive = message.source === 'client' && message.output ? 1 : 0;
  let incrementClientProductive = message.source === 'provider' && message.output ? 1 : 0;

  if (incrementClientProductive || incrementProviderProductive) {
    let incrementData = {
      totalProductiveClientMessageCount: incrementClientProductive
        ? { increment: 1 }
        : undefined,
      totalProductiveProviderMessageCount: incrementProviderProductive
        ? { increment: 1 }
        : undefined
    };

    if (message.connectionOid) {
      await db.sessionConnection.updateMany({
        where: { oid: message.connectionOid },
        data: incrementData
      });
    }

    if (message.sessionProviderOid) {
      await db.sessionProvider.updateMany({
        where: { oid: message.sessionProviderOid },
        data: incrementData
      });
    }

    await db.session.updateMany({
      where: { oid: message.sessionOid },
      data: incrementData
    });
  }

  if (
    initialClientProductive ||
    initialProviderProductive ||
    incrementClientProductive ||
    incrementProviderProductive
  ) {
    await db.sessionUsageRecord.create({
      data: {
        id: v7(),

        sessionOid: message.sessionOid,
        tenantOid: message.session.tenantOid,
        solutionOid: message.session.solutionOid,

        clientMessageIncrement: initialClientProductive + incrementClientProductive,
        providerMessageIncrement: initialProviderProductive + incrementProviderProductive
      }
    });
  }
});
