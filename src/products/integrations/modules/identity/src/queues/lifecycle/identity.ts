import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { reconcileQueue } from '../reconciler/reconcile';
import { indexIdentityQueue } from '../search/identity';
import { lcOpts } from './_opts';

export let identityCreatedQueue = createQueue<{ identityId: string }>({
  name: 'sub/idn/lc/identity/created',
  redisUrl: env.service.REDIS_URL,
  ...lcOpts
});

export let identityCreatedQueueProcessor = identityCreatedQueue.process(async data => {
  await indexIdentityQueue.add({ identityId: data.identityId });

  await reconcileQueue.add({ identityId: data.identityId });
});

export let identityUpdatedQueue = createQueue<{ identityId: string }>({
  name: 'sub/idn/lc/identity/updated',
  redisUrl: env.service.REDIS_URL,
  ...lcOpts
});

export let identityUpdatedQueueProcessor = identityUpdatedQueue.process(async data => {
  await indexIdentityQueue.add({ identityId: data.identityId });
});

export let identityDeletedQueue = createQueue<{ identityId: string }>({
  name: 'sub/idn/lc/identity/deleted',
  redisUrl: env.service.REDIS_URL,
  ...lcOpts
});

export let identityDeletedQueueProcessor = identityDeletedQueue.process(async data => {
  let identity = await db.identity.findUnique({
    where: { id: data.identityId }
  });
  if (!identity) return;

  await indexIdentityQueue.add({ identityId: data.identityId });

  await db.identityCredential.updateMany({
    where: { identityOid: identity.oid },
    data: { status: 'archived', archivedAt: identity.archivedAt ?? new Date() }
  });

  await reconcileQueue.add({ identityId: data.identityId });
});
