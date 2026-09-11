import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { reconcileQueue } from '../reconciler/reconcile';
import { lcOpts } from './_opts';

export let identityDelegationCreatedQueue = createQueue<{ identityDelegationId: string }>({
  name: 'sub/idn/lc/identityDelegation/created',
  redisUrl: env.service.REDIS_URL,
  ...lcOpts
});

export let identityDelegationCreatedQueueProcessor = identityDelegationCreatedQueue.process(
  async data => {
    let delegation = await db.identityDelegation.findUnique({
      where: { id: data.identityDelegationId },
      include: { identity: true }
    });
    if (!delegation) return;

    await reconcileQueue.add({ identityId: delegation.identity.id });
  }
);

export let identityDelegationUpdatedQueue = createQueue<{ identityDelegationId: string }>({
  name: 'sub/idn/lc/identityDelegation/updated',
  redisUrl: env.service.REDIS_URL,
  ...lcOpts
});

export let identityDelegationUpdatedQueueProcessor = identityDelegationUpdatedQueue.process(
  async data => {
    let delegation = await db.identityDelegation.findUnique({
      where: { id: data.identityDelegationId },
      include: { identity: true }
    });
    if (!delegation) return;

    await reconcileQueue.add({ identityId: delegation.identity.id });
  }
);
