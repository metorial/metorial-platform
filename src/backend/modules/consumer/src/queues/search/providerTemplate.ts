import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import {
  deleteProviderTemplateDocument,
  indexProviderTemplateDocument
} from '@metorial/module-search';

export let indexProviderTemplateSearchQueue = createQueue<{ providerTemplateId: string }>({
  name: 'cons/sidx/provider-template'
});

export let indexProviderTemplateSearchQueueProcessor =
  indexProviderTemplateSearchQueue.process(async data => {
    let providerTemplate = await db.providerTemplate.findUnique({
      where: {
        id: data.providerTemplateId
      },
      include: {
        instance: true
      }
    });
    if (!providerTemplate) throw new QueueRetryError();

    if (providerTemplate.status === 'deleted') {
      await deleteProviderTemplateDocument({ id: providerTemplate.id });
      return;
    }

    await indexProviderTemplateDocument({
      id: providerTemplate.id,
      instanceId: providerTemplate.instance.id,
      status: providerTemplate.status,
      name: providerTemplate.name,
      description: providerTemplate.description,
      providerDeploymentId: providerTemplate.providerDeploymentId
    });
  });
