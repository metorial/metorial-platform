import { createQueue } from '@lowerdeck/queue';
import { db, dbPrimary } from '@metorial-subspace/db';
import { Fabric } from '@metorial/fabric';
import { env } from '../../env';
import { recordMessageAuditEvent } from '../../audit/recordMessage';
import {
  applyMessageActivity,
  claimMessageActivity,
  getCreationIncrements,
  shouldEvaluateProtoGuard
} from '../../shared/messageActivity';
import { protoGuardMessageQueue } from './protoGuard';

export let finalizeMessageQueue = createQueue<{ messageId: string }>({
  name: 'sub/con/msg/fin',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

let finalizeMessage = async (messageId: string) => {
  let message = await dbPrimary.sessionMessage.findUnique({
    where: { id: messageId },
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

  let creation = getCreationIncrements(message);
  let countCreation = !message.activityCountedAt && (await claimMessageActivity(message.oid));

  let respondedTo = message.hasOutput || message.output !== null;

  let incrementProviderProductive = message.source === 'client' && respondedTo ? 1 : 0;
  let incrementClientProductive = message.source === 'provider' && respondedTo ? 1 : 0;

  await applyMessageActivity(message, {
    touch: countCreation,
    client: incrementClientProductive + (countCreation ? creation.client : 0),
    provider: incrementProviderProductive + (countCreation ? creation.provider : 0)
  });

  let clientMessageIncrement = creation.client + incrementClientProductive;
  let providerMessageIncrement = creation.provider + incrementProviderProductive;

  if ((clientMessageIncrement || providerMessageIncrement) && message.instanceOid) {
    await Fabric.fire('provider.session_message.usage:after', {
      instanceOid: message.instanceOid,
      clientMessageIncrement,
      providerMessageIncrement
    });
  }

  if (shouldEvaluateProtoGuard(message)) {
    await protoGuardMessageQueue.add({ messageId: message.id }, { id: message.id });
  }
};

export let finalizeMessageQueueProcessor = finalizeMessageQueue.process(async data => {
  let claimed = await db.sessionMessage.updateMany({
    where: { id: data.messageId, finalizedAt: null },
    data: { finalizedAt: new Date() }
  });
  if (!claimed.count) return;

  try {
    await finalizeMessage(data.messageId);
  } catch (err) {
    await db.sessionMessage.updateMany({
      where: { id: data.messageId },
      data: { finalizedAt: null }
    });

    throw err;
  }
});
