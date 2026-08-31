import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { Fabric } from '@metorial/fabric';
import { env } from '../../env';
import { recordMessageAuditEvent } from '../../audit/recordMessage';
import { protoGuardMessageQueue } from './protoGuard';

export let finalizeMessageQueue = createQueue<{ messageId: string }>({
  name: 'sub/con/msg/fin',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

export let finalizeMessageQueueProcessor = finalizeMessageQueue.process(async data => {
  let message = await db.sessionMessage.findFirst({
    where: { id: data.messageId },
    include: {
      session: true,
      sessionProvider: { include: { provider: { select: { id: true, name: true } } } },
      connection: { select: { id: true } },
      senderParticipant: {
        include: {
          identity: { select: { id: true } },
          identityActor: { select: { id: true } }
        }
      },
      toolCall: { include: { tool: { select: { key: true } } } }
    }
  });
  if (!message) return;

  await recordMessageAuditEvent(message);

  let initialClientProductive = message.isProductive && message.source === 'client' ? 1 : 0;
  let initialProviderProductive =
    message.isProductive && message.source === 'provider' ? 1 : 0;

  let respondedTo = message.hasOutput || message.output !== null;

  let incrementProviderProductive = message.source === 'client' && respondedTo ? 1 : 0;
  let incrementClientProductive = message.source === 'provider' && respondedTo ? 1 : 0;

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

  let clientMessageIncrement = initialClientProductive + incrementClientProductive;
  let providerMessageIncrement = initialProviderProductive + incrementProviderProductive;

  if ((clientMessageIncrement || providerMessageIncrement) && message.instanceOid) {
    await Fabric.fire('provider.session_message.usage:after', {
      instanceOid: message.instanceOid,
      clientMessageIncrement,
      providerMessageIncrement
    });
  }

  if (message.retentionLevel === 'full') {
    await protoGuardMessageQueue.add({ messageId: message.id });
  }
});
