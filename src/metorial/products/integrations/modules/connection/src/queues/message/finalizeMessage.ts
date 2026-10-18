import { createQueue } from '@lowerdeck/queue';
import { db, dbPrimary } from '@metorial-subspace/db';
import { Fabric } from '@metorial/fabric';
import { env } from '../../env';
import { recordMessageAuditEvent } from '../../audit/recordMessage';
import {
  getCreationIncrements,
  recordMessageActivity,
  shouldEvaluateProtoGuard
} from '../../shared/messageActivity';
import { protoGuardMessageQueue } from './protoGuard';

export let finalizeMessageQueue = createQueue<{ messageId: string }>({
  name: 'sub/con/msg/fin',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

let finalizeMessage = async (messageId: string, progress: { activityRecorded: boolean }) => {
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

  if (shouldEvaluateProtoGuard(message)) {
    await protoGuardMessageQueue.add({ messageId: message.id }, { id: message.id });
  }

  let creation = getCreationIncrements(message);
  let respondedTo = message.hasOutput || message.output !== null;

  let incrementProviderProductive = message.source === 'client' && respondedTo ? 1 : 0;
  let incrementClientProductive = message.source === 'provider' && respondedTo ? 1 : 0;

  await recordMessageActivity(message, {
    response: { client: incrementClientProductive, provider: incrementProviderProductive }
  });
  progress.activityRecorded = true;

  let clientMessageIncrement = creation.client + incrementClientProductive;
  let providerMessageIncrement = creation.provider + incrementProviderProductive;

  if ((clientMessageIncrement || providerMessageIncrement) && message.instanceOid) {
    await Fabric.fire('provider.session_message.usage:after', {
      instanceOid: message.instanceOid,
      clientMessageIncrement,
      providerMessageIncrement
    });
  }
};

export let finalizeMessageQueueProcessor = finalizeMessageQueue.process(async data => {
  let claimed = await db.sessionMessage.updateMany({
    where: { id: data.messageId, finalizedAt: null },
    data: { finalizedAt: new Date() }
  });
  if (!claimed.count) return;

  let progress = { activityRecorded: false };

  try {
    await finalizeMessage(data.messageId, progress);
  } catch (err) {
    // Once the counters are committed a retry would apply the response increments again.
    if (!progress.activityRecorded) {
      await db.sessionMessage.updateMany({
        where: { id: data.messageId },
        data: { finalizedAt: null }
      });
    }

    throw err;
  }
});
