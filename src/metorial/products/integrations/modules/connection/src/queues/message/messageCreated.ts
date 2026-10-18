import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { dbPrimary } from '@metorial-subspace/db';
import { env } from '../../env';
import { recordMessageActivity } from '../../shared/messageActivity';
import { finalizeMessageQueue } from './finalizeMessage';
import { messageTimeoutQueue } from './messageTimeout';

let MESSAGE_TIMEOUT_FALLBACK_INITIAL_DELAY_MS = 60_000;

export let messageCreatedQueue = createQueue<{ messageId: string }>({
  name: 'sub/con/msg/created',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 25 }
});

export let messageCreatedQueueProcessor = messageCreatedQueue.process(async data => {
  let message = await dbPrimary.sessionMessage.findUnique({
    where: { id: data.messageId },
    select: {
      oid: true,
      id: true,
      status: true,
      isProductive: true,
      source: true,
      sessionOid: true,
      connectionOid: true,
      sessionProviderOid: true
    }
  });
  if (!message) throw new QueueRetryError();

  // Completed messages are counted by finalize, which folds the creation and response
  // counters into a single update per row.
  if (message.status != 'waiting_for_response') {
    await finalizeMessageQueue.add({ messageId: message.id }, { id: message.id });
    return;
  }

  await recordMessageActivity(
    { ...message, activityCountedAt: null },
    { response: { client: 0, provider: 0 } }
  );

  await messageTimeoutQueue.add(
    { messageId: message.id, attempt: 0 },
    { delay: MESSAGE_TIMEOUT_FALLBACK_INITIAL_DELAY_MS, id: `${message.id}:timeout:0` }
  );
});
