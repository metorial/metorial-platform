import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import type { ConduitResult } from '@metorial-subspace/connection-utils';
import { db } from '@metorial-subspace/db';
import { serialize } from '@lowerdeck/serialize';
import { env } from '../../env';
import { broadcastNats } from '../../lib/nats';
import { topics } from '../../lib/topic';
import { completeMessage } from '../../shared/completeMessage';
import { upsertParticipant } from '../../shared/upsertParticipant';

let MESSAGE_TIMEOUT_FALLBACK_MS = 20 * 60 * 1000;
let MESSAGE_TIMEOUT_RECHECK_DELAY_MS = 60_000;

export let messageTimeoutQueue = createQueue<{ messageId: string }>({
  name: 'sub/con/msg/to',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

export let messageTimeoutQueueProcessor = messageTimeoutQueue.process(async data => {
  let message = await db.sessionMessage.findFirst({
    where: { id: data.messageId },
    include: { session: true, connection: true }
  });
  if (!message) throw new QueueRetryError();

  // If the message is completed - no timeout is needed
  if (message.status != 'waiting_for_response') return;

  let ageMs = Math.max(0, Date.now() - message.createdAt.getTime());
  if (ageMs >= MESSAGE_TIMEOUT_FALLBACK_MS) {
    let responderParticipant = await upsertParticipant({
      session: message.session,
      from: { type: 'system' }
    });

    let completedMessage = await completeMessage(
      { messageId: message.id },
      {
        responderParticipant,
        failureReason: 'timeout',
        status: 'failed',
        completedAt: new Date(),
        output: {
          type: 'error',
          data: {
            code: 'timeout',
            message: 'The message failed to receive a response from the provider before the fallback timeout elapsed.'
          }
        }
      }
    );

    let result = {
      message: completedMessage,
      output: completedMessage.output,
      status: completedMessage.status,
      completedAt: completedMessage.completedAt
    } satisfies ConduitResult;

    if (message.connection) {
      await broadcastNats.publish(
        topics.sessionConnection.encode({
          session: message.session,
          connection: message.connection
        }),
        serialize.encode({
          type: 'message_processed',
          sessionId: message.session.id,
          channel: 'targeted_response',
          result
        })
      );

      if (message.transport === 'mcp') {
        await broadcastNats.publish(
          topics.mcpConnection.encode({
            session: message.session,
            connection: message.connection
          }),
          serialize.encode({
            type: 'mcp_control_message',
            channel: 'broadcast_response_or_notification',
            conduit: result
          })
        );
      }
    }

    return;
  }

  await messageTimeoutQueue.add(data, {
    delay: MESSAGE_TIMEOUT_RECHECK_DELAY_MS,
    id: data.messageId
  });
});
