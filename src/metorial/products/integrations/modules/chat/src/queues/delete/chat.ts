import {
  archivedCleanupFindArgs,
  archivedCleanupWhere,
  archivedCleanupWorkerOpts,
  createArchivedCleanupScan
} from '@metorial-subspace/archived-cleanup';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { deleteChatsWhere } from '../../lib/chatLifecycle';

let chatArchivedCleanup = createArchivedCleanupScan({
  cronName: 'sub/cht/cron/chatArchivedCleanup',
  cron: '0 0 * * *',
  manyQueueName: 'sub/cht/delete/chat/many',
  redisUrl: env.service.REDIS_URL,
  findArchived: ({ cursor, take }) =>
    db.chat.findMany({
      where: archivedCleanupWhere({ cursor }),
      ...archivedCleanupFindArgs({ cursor, take })
    }),
  enqueue: ids => chatDeleteQueue.addMany(ids.map(id => ({ chatId: id })))
});

export let chatArchivedCleanupCron = chatArchivedCleanup.cron;
export let chatDeleteManyQueue = chatArchivedCleanup.manyQueue;
export let chatDeleteManyQueueProcessor = chatArchivedCleanup.manyProcessor;

export let chatDeleteQueue = createQueue<{ chatId: string }>({
  name: 'sub/cht/delete/chat',
  redisUrl: env.service.REDIS_URL,
  workerOpts: archivedCleanupWorkerOpts()
});

export let chatDeleteQueueProcessor = chatDeleteQueue.process(async data => {
  let chat = await db.chat.findUnique({
    where: { id: data.chatId }
  });
  if (!chat || chat.status !== 'archived') return;

  await deleteChatsWhere({ oid: chat.oid });
});
