import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexIdentityActorQueue = createQueue<{ identityActorId: string }>({
  name: 'sub/idn/sidx/identityActor',
  redisUrl: env.service.REDIS_URL
});

export let indexIdentityActorQueueProcessor = indexIdentityActorQueue.process(async data => {
  let identityActor = await db.identityActor.findUnique({
    where: { id: data.identityActorId },
    include: { tenant: true }
  });
  if (!identityActor) throw new QueueRetryError();

  if (
    (!identityActor.name && !identityActor.description) ||
    identityActor.status != 'active'
  ) {
    await voyager.record.delete({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.identityActor.id,
      documentIds: [identityActor.id]
    });
    return;
  }

  await voyager.record.index({
    sourceId: (await voyagerSource).id,
    indexId: voyagerIndex.identityActor.id,

    documentId: identityActor.id,
    tenantIds: [identityActor.tenant.id],

    fields: { identityId: identityActor.id },
    body: {
      name: identityActor.name,
      description: identityActor.description
    }
  });
});
