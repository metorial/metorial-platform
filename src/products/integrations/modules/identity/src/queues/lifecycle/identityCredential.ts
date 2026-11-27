import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { reconcileQueue } from '../reconciler/reconcile';
import { lcOpts } from './_opts';

export let identityCredentialCreatedQueue = createQueue<{ identityCredentialId: string }>({
  name: 'sub/idn/lc/identityCredential/created',
  redisUrl: env.service.REDIS_URL,
  ...lcOpts
});

export let identityCredentialCreatedQueueProcessor = identityCredentialCreatedQueue.process(
  async data => {
    let credential = await db.identityCredential.findUnique({
      where: { id: data.identityCredentialId },
      include: { identity: true }
    });
    if (!credential) return;

    await reconcileQueue.add({ identityId: credential.identity.id });
  }
);

export let identityCredentialUpdatedQueue = createQueue<{ identityCredentialId: string }>({
  name: 'sub/idn/lc/identityCredential/updated',
  redisUrl: env.service.REDIS_URL,
  ...lcOpts
});

export let identityCredentialUpdatedQueueProcessor = identityCredentialUpdatedQueue.process(
  async data => {
    let credential = await db.identityCredential.findUnique({
      where: { id: data.identityCredentialId },
      include: { identity: true }
    });
    if (!credential) return;

    await reconcileQueue.add({ identityId: credential.identity.id });
  }
);

export let identityCredentialDeletedQueue = createQueue<{ identityCredentialId: string }>({
  name: 'sub/idn/lc/identityCredential/deleted',
  redisUrl: env.service.REDIS_URL,
  ...lcOpts
});

export let identityCredentialDeletedQueueProcessor = identityCredentialDeletedQueue.process(
  async data => {
    let credential = await db.identityCredential.findUnique({
      where: { id: data.identityCredentialId },
      include: { identity: true }
    });
    if (!credential) return;

    await reconcileQueue.add({ identityId: credential.identity.id });
  }
);
