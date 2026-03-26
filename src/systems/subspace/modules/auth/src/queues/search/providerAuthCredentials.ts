import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexProviderAuthCredentialsQueue = createQueue<{
  providerAuthCredentialsId: string;
}>({
  name: 'sub/auth/sidx/providerAuthCredentials',
  redisUrl: env.service.REDIS_URL
});

export let indexProviderAuthCredentialsQueueProcessor =
  indexProviderAuthCredentialsQueue.process(async data => {
    let providerAuthCredentials = await db.providerAuthCredentials.findUnique({
      where: { id: data.providerAuthCredentialsId },
      include: { tenant: true, provider: true }
    });
    if (!providerAuthCredentials) throw new QueueRetryError();

    let {
      origin,
      name,
      description,
      provider,
      id: credentialsId,
      tenant
    } = providerAuthCredentials;

    if (!tenant) {
      return;
    }

    if (!name && !description) {
      await voyager.record.delete({
        sourceId: (await voyagerSource).id,
        indexId: voyagerIndex.providerAuthCredentials.id,
        documentIds: [credentialsId]
      });
      return;
    }

    await voyager.record.index({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.providerAuthCredentials.id,

      documentId: credentialsId,
      tenantIds: [tenant!.id],

      fields: {
        providerId: provider.id,
        configId: credentialsId,
        origin
      },
      body: {
        name: name,
        description: description,
        providerName: provider.name
      }
    });
  });
