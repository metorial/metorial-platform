import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { subMinutes } from 'date-fns';
import { env } from '../../env';

let EXPIRE_SESSIONS_BATCH_SIZE = 500;

let getExpiredSessionsWhere = () => ({
  connectionState: 'connected' as const,
  lastActiveAt: { lt: subMinutes(new Date(), 2) }
});

let expireSessionsCron = createCron(
  {
    name: 'sub/con/ses/expire',
    cron: '25 2-59/5 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await expireSessionsQueue.add({}, { id: 'expire-sessions-root' });
  }
);

let expireSessionsQueue = createQueue<{ cursor?: string }>({
  name: 'sub/con/ses/expire/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

let expireSessionsQueueProcessor = expireSessionsQueue.process(async data => {
  let sessions = await db.session.findMany({
    where: {
      ...getExpiredSessionsWhere(),
      oid: data.cursor ? { gt: BigInt(data.cursor) } : undefined
    },
    orderBy: { oid: 'asc' },
    take: EXPIRE_SESSIONS_BATCH_SIZE,
    select: { oid: true }
  });
  if (!sessions.length) return;

  await db.session.updateMany({
    where: {
      ...getExpiredSessionsWhere(),
      oid: { in: sessions.map(session => session.oid) }
    },
    data: { connectionState: 'disconnected' }
  });

  if (sessions.length === EXPIRE_SESSIONS_BATCH_SIZE) {
    await expireSessionsQueue.add(
      { cursor: sessions[sessions.length - 1]!.oid.toString() },
      { delay: 250 }
    );
  }
});

export let expireSessionsQueues = combineQueueProcessors([
  expireSessionsCron,
  expireSessionsQueueProcessor
]);
