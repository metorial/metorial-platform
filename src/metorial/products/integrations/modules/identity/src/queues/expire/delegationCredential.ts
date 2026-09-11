import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { reconcileQueue } from '../reconciler/reconcile';

export let expireIdentityDelegationCredentialsCron = createCron(
  {
    name: 'sub/idn/exp/identityDelegationCredentials/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    await expireIdentityDelegationCredentialsManyQueue.add({}, { id: 'many' });
  }
);

export let expireIdentityDelegationCredentialsManyQueue = createQueue<{
  cursor?: string;
}>({
  name: 'sub/idn/exp/identityDelegationCredentials/many',
  redisUrl: env.service.REDIS_URL
});

export let expireIdentityDelegationCredentialsManyQueueProcessor =
  expireIdentityDelegationCredentialsManyQueue.process(async data => {
    let expired = await db.identityDelegationCredentialOverride.findMany({
      where: {
        expiresAt: { lte: new Date() },
        status: { in: ['active'] },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: {
        id: true,
        oid: true,
        delegation: {
          select: {
            id: true,
            identity: { select: { id: true } }
          }
        }
      }
    });
    if (expired.length === 0) return;

    await db.identityDelegationCredentialOverride.updateMany({
      where: { oid: { in: expired.map(d => d.oid) } },
      data: { status: 'expired' }
    });

    await reconcileQueue.addManyWithOps(
      expired.map(d => ({
        data: { identityId: d.delegation.identity.id },
        opts: {
          id: `exp-${d.delegation.id}`
        }
      }))
    );

    await expireIdentityDelegationCredentialsManyQueue.add({
      cursor: expired[expired.length - 1].id
    });
  });
