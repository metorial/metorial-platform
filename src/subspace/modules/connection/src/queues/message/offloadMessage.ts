import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { offload } from '@metorial-subspace/connection-utils';
import { db } from '@metorial-subspace/db';
import { subDays } from 'date-fns';
import { env } from '../../env';

let offloadCron = createCron(
  {
    name: 'sub/con/ofl/cron',
    cron: '30 4 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await offloadMessagesQueue.add({});
  }
);

let offloadMessagesQueue = createQueue<{ cursor?: string }>({
  name: 'sub/con/ofl/msg/many',
  redisUrl: env.service.REDIS_URL
});

let offloadMessagesQueueProcessor = offloadMessagesQueue.process(async data => {
  let twoDaysAgo = subDays(new Date(), 2);

  let messages = await db.sessionMessage.findMany({
    where: {
      isOffloadedToStorage: false,
      status: { in: ['failed', 'succeeded'] },
      createdAt: { lte: twoDaysAgo },
      id: data.cursor ? { gt: data.cursor } : undefined
    },
    orderBy: { id: 'asc' },
    take: 100,
    select: { id: true }
  });
  if (messages.length === 0) return;

  await offloadMessageQueue.addMany(messages.map(msg => ({ messageId: msg.id })));

  let lastMessage = messages[messages.length - 1];
  await offloadMessagesQueue.add({ cursor: lastMessage!.id });
});

let offloadMessageQueue = createQueue<{ messageId: string }>({
  name: 'sub/con/ofl/msg',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5 }
});

let offloadMessageQueueProcessor = offloadMessageQueue.process(async data => {
  let message = await db.sessionMessage.findUnique({
    where: { id: data.messageId }
  });
  if (!message || message?.isOffloadedToStorage) return;

  await offload.offloadSessionMessage(message);
});

export let offloadQueues = combineQueueProcessors([
  offloadCron,
  offloadMessageQueueProcessor,
  offloadMessagesQueueProcessor
]);
