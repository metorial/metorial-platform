import {
  archivedCleanupFindArgs,
  archivedCleanupWorkerOpts,
  createArchivedCleanupScan
} from '@metorial-subspace/archived-cleanup';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { subDays } from 'date-fns';
import { env } from '../../env';

let getDeletedMessageCutoffDate = () => subDays(new Date(), 5);

let chatMessageDeletedCleanup = createArchivedCleanupScan({
  cronName: 'sub/cht/cron/deletedMessageCleanup',
  cron: '0 1 * * *',
  manyQueueName: 'sub/cht/delete/chatMessage/many',
  redisUrl: env.service.REDIS_URL,
  findArchived: ({ cursor, take }) =>
    db.chatMessage.findMany({
      where: {
        deletedAt: { lt: getDeletedMessageCutoffDate() },
        ...(cursor ? { id: { gt: cursor } } : {})
      },
      ...archivedCleanupFindArgs({ cursor, take })
    }),
  enqueue: ids => chatMessageDeleteQueue.addMany(ids.map(id => ({ messageId: id })))
});

export let chatMessageDeletedCleanupCron = chatMessageDeletedCleanup.cron;
export let chatMessageDeleteManyQueue = chatMessageDeletedCleanup.manyQueue;
export let chatMessageDeleteManyQueueProcessor = chatMessageDeletedCleanup.manyProcessor;

export let chatMessageDeleteQueue = createQueue<{ messageId: string }>({
  name: 'sub/cht/delete/chatMessage',
  redisUrl: env.service.REDIS_URL,
  workerOpts: archivedCleanupWorkerOpts({ max: 20, duration: 1000 })
});

export let chatMessageDeleteQueueProcessor = chatMessageDeleteQueue.process(async data => {
  let message = await db.chatMessage.findUnique({
    where: { id: data.messageId },
    select: { oid: true, deletedAt: true }
  });
  if (!message?.deletedAt || message.deletedAt >= getDeletedMessageCutoffDate()) return;

  await db.chatMessage.delete({ where: { oid: message.oid } });
});
