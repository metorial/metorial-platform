import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexIdentityDelegationConfigQueue = createQueue<{
  identityDelegationConfigId: string;
}>({
  name: 'sub/idn/sidx/identityDelegationConfig',
  redisUrl: env.service.REDIS_URL
});

export let indexIdentityDelegationConfigQueueProcessor =
  indexIdentityDelegationConfigQueue.process(async data => {
    let identityDelegationConfig = await db.identityDelegationConfig.findUnique({
      where: { id: data.identityDelegationConfigId },
      include: { tenant: true }
    });
    if (!identityDelegationConfig) throw new QueueRetryError();

    if (
      (!identityDelegationConfig.name && !identityDelegationConfig.description) ||
      identityDelegationConfig.status != 'active'
    ) {
      await voyager.record.delete({
        sourceId: (await voyagerSource).id,
        indexId: voyagerIndex.identityDelegationConfig.id,
        documentIds: [identityDelegationConfig.id]
      });
      return;
    }

    await voyager.record.index({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.identityDelegationConfig.id,

      documentId: identityDelegationConfig.id,
      tenantIds: [identityDelegationConfig.tenant.id],

      fields: { identityDelegationConfigId: identityDelegationConfig.id },
      body: {
        name: identityDelegationConfig.name,
        description: identityDelegationConfig.description
      }
    });
  });
