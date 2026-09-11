import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexIdentityQueue = createQueue<{ identityId: string }>({
  name: 'sub/idn/sidx/identity',
  redisUrl: env.service.REDIS_URL
});

export let indexIdentityQueueProcessor = indexIdentityQueue.process(async data => {
  let identity = await db.identity.findUnique({
    where: { id: data.identityId },
    include: { tenant: true }
  });
  if (!identity) throw new QueueRetryError();

  if ((!identity.name && !identity.description) || identity.status != 'active') {
    await voyager.record.delete({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.identity.id,
      documentIds: [identity.id]
    });
    return;
  }

  await voyager.record.index({
    sourceId: (await voyagerSource).id,
    indexId: voyagerIndex.identity.id,

    documentId: identity.id,
    tenantIds: [identity.tenant.id],

    fields: { identityId: identity.id },
    body: {
      name: identity.name,
      description: identity.description
    }
  });
});
