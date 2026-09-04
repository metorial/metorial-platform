import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { reconcileQueue } from '../reconciler/reconcile';

export let expireIdentityDelegationsCron = createCron(
  {
    name: 'sub/idn/exp/identityDelegations/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    await expireIdentityDelegationsManyQueue.add({}, { id: 'many' });
  }
);

export let expireIdentityDelegationsManyQueue = createQueue<{
  cursor?: string;
}>({
  name: 'sub/idn/exp/identityDelegations/many',
  redisUrl: env.service.REDIS_URL
});

export let expireIdentityDelegationsManyQueueProcessor =
  expireIdentityDelegationsManyQueue.process(async data => {
    let expired = await db.identityDelegation.findMany({
      where: {
        expiresAt: { lte: new Date() },
        status: { in: ['active', 'waiting_for_consent'] },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, oid: true, identity: { select: { id: true } } }
    });
    if (expired.length === 0) return;

    await db.identityDelegation.updateMany({
      where: { oid: { in: expired.map(d => d.oid) } },
      data: { status: 'expired' }
    });

    await reconcileQueue.addManyWithOps(
      expired.map(d => ({
        data: { identityId: d.identity.id },
        opts: {
          id: `exp-${d.id}`
        }
      }))
    );

    await expireIdentityDelegationsManyQueue.add({
      cursor: expired[expired.length - 1].id
    });
  });
