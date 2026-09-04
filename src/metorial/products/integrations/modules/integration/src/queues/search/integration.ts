import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexIntegrationQueue = createQueue<{ integrationId: string }>({
  name: 'sub/int/sidx/integration',
  redisUrl: env.service.REDIS_URL
});

export let indexIntegrationQueueProcessor = indexIntegrationQueue.process(async data => {
  let integration = await db.integration.findUnique({
    where: { id: data.integrationId },
    include: {
      tenant: true,
      providers: {
        where: { status: 'active' },
        include: { provider: true }
      }
    }
  });
  if (!integration) throw new QueueRetryError();

  if (integration.status !== 'active' || (!integration.name && !integration.description)) {
    await voyager.record.delete({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.integration.id,
      documentIds: [integration.id]
    });
    return;
  }

  await voyager.record.index({
    sourceId: (await voyagerSource).id,
    indexId: voyagerIndex.integration.id,

    documentId: integration.id,
    tenantIds: [integration.tenant.id],

    fields: {
      integrationId: integration.id,
      providerIds: integration.providers.map(provider => provider.provider.id)
    },

    body: {
      name: integration.name,
      description: integration.description,
      providerNames: integration.providers.map(provider => provider.provider.name)
    }
  });
});
