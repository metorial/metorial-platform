import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { createHmac } from 'crypto';
import { addAfterTransactionHook, db, type TransactionDB } from '../db';
import { env } from '../env';

export let userSyncCallbackQueue = createQueue<{ userId: string; revision: string }>({
  name: 'ares/user/sync-callback',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5 }
});

let userSyncCallbackProcessor = userSyncCallbackQueue.process(async input => {
  let listeners = await db.userSyncListener.findMany({ select: { id: true } });
  await userSyncDeliveryQueue.addMany(
    listeners.map(listener => ({ listenerId: listener.id, ...input }))
  );
});

let userSyncDeliveryQueue = createQueue<{
  listenerId: string;
  userId: string;
  revision: string;
}>({
  name: 'ares/user/sync-callback-delivery',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

let userSyncDeliveryProcessor = userSyncDeliveryQueue.process(async input => {
  let [user, listener] = await Promise.all([
    db.user.findUnique({ where: { id: input.userId }, include: { app: true } }),
    db.userSyncListener.findUnique({ where: { id: input.listenerId } })
  ]);
  if (!user || !listener) return;
  let body = JSON.stringify({
    type: 'user.changed',
    data: {
      appId: user.app.id,
      userId: user.id,
      revision: input.revision
    }
  });
  let timestamp = Math.floor(Date.now() / 1000).toString();
  let signature = createHmac('sha256', listener.secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  let response = await fetch(listener.callbackUrl, {
    method: 'POST',
    headers: {
      'ares-signature': `t=${timestamp},v1=${signature}`,
      'content-type': 'application/json'
    },
    body
  });
  if (!response.ok) {
    let body = await response.text().catch(() => '');
    throw new Error(
      `User sync listener ${listener.identifier} returned ${response.status}: ${body.slice(0, 500)}`
    );
  }
});

export let markAresUserChanged = async (input: {
  userId?: string;
  userOid?: bigint;
  db?: TransactionDB;
}) => {
  let tdb = input.db ?? db;
  let user = await tdb.user.update({
    where: input.userId ? { id: input.userId } : { oid: input.userOid! },
    data: { syncRevision: { increment: 1 } },
    select: { id: true, syncRevision: true }
  });
  addAfterTransactionHook(() =>
    userSyncCallbackQueue.add(
      { userId: user.id, revision: user.syncRevision.toString() },
      { id: `${user.id}-${user.syncRevision}` }
    )
  );
  return user;
};

export let userSyncCallbackQueueProcessor = combineQueueProcessors([
  userSyncCallbackProcessor,
  userSyncDeliveryProcessor
]);
